package app.jkt48connect.core

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Pengendali musik di sisi UI: tersambung ke [MusicService] lewat MediaController, jadi lagu tetap berjalan
 * walau layar/aplikasi ditutup dan UI bisa tersambung lagi kapan pun. Status di sini dibaca langsung oleh Compose.
 */
object Music {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var connecting = false
    private var pending: (() -> Unit)? = null
    private lateinit var prefs: SharedPreferences
    private val known = HashMap<String, MusicTrack>()
    private var lyricsJob: Job? = null
    private var retriedFor: String? = null

    var controller by mutableStateOf<MediaController?>(null)
        private set
    var current by mutableStateOf<MusicTrack?>(null)
        private set
    var playing by mutableStateOf(false)
        private set
    var buffering by mutableStateOf(false)
        private set
    var durationMs by mutableLongStateOf(0L)
        private set
    var queue by mutableStateOf<List<MusicTrack>>(emptyList())
        private set
    var index by mutableIntStateOf(0)
        private set
    var lyrics by mutableStateOf<Lyrics?>(null)
        private set
    var lyricsLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
    var history by mutableStateOf<List<MusicTrack>>(emptyList())
        private set
    var shuffle by mutableStateOf(false)
        private set
    var repeat by mutableIntStateOf(Player.REPEAT_MODE_OFF)
        private set

    /** Layar "Sedang diputar" terbuka (mini player disembunyikan). */
    var nowPlayingOpen by mutableStateOf(false)

    /** Lagu yang disukai (terbaru di depan) & playlist buatan pengguna; disimpan di perangkat. */
    var liked by mutableStateOf<List<MusicTrack>>(emptyList())
        private set
    var playlists by mutableStateOf<List<Playlist>>(emptyList())
        private set

    /** Lembar aksi yang sedang terbuka (menu lagu, playlist baru, timer tidur, kecepatan). */
    var sheet by mutableStateOf<MusicSheet?>(null)

    /** Pesan singkat di atas layar ("Ditambahkan ke antrean"). */
    var toast by mutableStateOf<String?>(null)
        private set
    private var toastJob: Job? = null

    /** Timer tidur: waktu berhenti (epoch ms, 0 = mati) atau berhenti di akhir lagu ini. */
    var sleepAt by mutableLongStateOf(0L)
        private set
    var sleepEndOfTrack by mutableStateOf(false)
        private set
    private var sleepJob: Job? = null

    var speed by mutableFloatStateOf(1f)
        private set

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.getSharedPreferences("music", Context.MODE_PRIVATE)
        history = runCatching { JSONArray(prefs.getString("history", "[]")).objects().map(MusicTrack::from) }.getOrDefault(emptyList())
        history.forEach { known[it.id] = it }
        liked = runCatching { JSONArray(prefs.getString("liked", "[]")).objects().map(MusicTrack::from) }.getOrDefault(emptyList())
        playlists = runCatching { JSONArray(prefs.getString("playlists", "[]")).objects().map(Playlist::from) }.getOrDefault(emptyList())
        (liked + playlists.flatMap { it.tracks }).forEach { known[it.id] = it }
        // Service masih memutar dari sesi sebelumnya (aplikasi dibuka lagi dari notifikasi): sambungkan diam-diam.
        connect(context)
    }

    fun connect(context: Context, then: (() -> Unit)? = null) {
        controller?.let { then?.invoke(); return }
        if (then != null) pending = then
        if (connecting) return
        connecting = true
        val app = context.applicationContext
        val future = MediaController.Builder(app, SessionToken(app, ComponentName(app, MusicService::class.java))).buildAsync()
        future.addListener({
            connecting = false
            val c = runCatching { future.get() }.getOrNull() ?: return@addListener
            controller = c
            c.addListener(listener)
            sync(c)
            pending?.invoke()
            pending = null
        }, ContextCompat.getMainExecutor(app))
    }

    /** Putar daftar lagu mulai dari `start` (antrean = seluruh daftar). */
    fun play(context: Context, tracks: List<MusicTrack>, start: Int) {
        if (tracks.isEmpty()) return
        tracks.forEach { known[it.id] = it }
        error = null
        connect(context) {
            val c = controller ?: return@connect
            c.setMediaItems(tracks.map(::item), start.coerceIn(0, tracks.lastIndex), 0L)
            c.prepare()
            c.play()
        }
    }

    fun toggle() {
        val c = controller ?: return
        if (c.playbackState == Player.STATE_ENDED) c.seekTo(0)
        if (c.isPlaying) c.pause() else c.play()
    }

    fun next() = controller?.run { if (hasNextMediaItem()) seekToNextMediaItem() else seekTo(0, 0) }

    /** Seperti pemutar musik umumnya: kembali ke awal lagu bila sudah lewat 3 detik, selain itu lagu sebelumnya. */
    fun previous() = controller?.run { if (currentPosition > 3000 || !hasPreviousMediaItem()) seekTo(0) else seekToPreviousMediaItem() }

    fun seekTo(ms: Long) = controller?.seekTo(ms.coerceAtLeast(0))

    fun playAt(i: Int) = controller?.run { if (i in 0 until mediaItemCount) { seekTo(i, 0); play() } }

    fun toggleShuffle() = controller?.run { shuffleModeEnabled = !shuffleModeEnabled }

    fun cycleRepeat() = controller?.run {
        repeatMode = when (repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    // ---- Antrean ----

    /** Sisipkan tepat setelah lagu yang sedang diputar (atau mulai putar bila antrean kosong). */
    fun playNext(context: Context, t: MusicTrack) {
        known[t.id] = t
        connect(context) {
            val c = controller ?: return@connect
            if (c.mediaItemCount == 0) play(context, listOf(t), 0) else c.addMediaItem(c.currentMediaItemIndex + 1, item(t))
        }
        say("Diputar berikutnya: ${t.title}")
    }

    /** Tambahkan ke akhir antrean. */
    fun addToQueue(context: Context, t: MusicTrack) {
        known[t.id] = t
        connect(context) {
            val c = controller ?: return@connect
            if (c.mediaItemCount == 0) play(context, listOf(t), 0) else c.addMediaItem(item(t))
        }
        say("Ditambahkan ke antrean")
    }

    fun removeAt(i: Int) = controller?.run { if (i != currentMediaItemIndex && i in 0 until mediaItemCount) removeMediaItem(i) }

    fun move(from: Int, to: Int) = controller?.run { if (from in 0 until mediaItemCount && to in 0 until mediaItemCount && from != to) moveMediaItem(from, to) }

    /** Hapus semua lagu setelah yang sedang diputar. */
    fun clearUpNext() = controller?.run {
        val start = currentMediaItemIndex + 1
        if (start < mediaItemCount) { removeMediaItems(start, mediaItemCount); say("Antrean dibersihkan") }
    }

    // ---- Suka & playlist ----

    fun isLiked(id: String) = liked.any { it.id == id }

    fun toggleLike(t: MusicTrack) {
        known[t.id] = t
        val was = isLiked(t.id)
        liked = if (was) liked.filter { it.id != t.id } else listOf(t) + liked
        save("liked", liked)
        say(if (was) "Dihapus dari Disukai" else "Ditambahkan ke Disukai")
    }

    fun createPlaylist(name: String, first: MusicTrack?): Playlist {
        val p = Playlist("p" + System.currentTimeMillis().toString(36), name.trim().ifEmpty { "Playlist baru" }.take(60), listOfNotNull(first))
        playlists = playlists + p
        savePlaylists()
        say(if (first != null) "Playlist “${p.name}” dibuat dengan ${first.title}" else "Playlist “${p.name}” dibuat")
        return p
    }

    fun addToPlaylist(id: String, t: MusicTrack) {
        known[t.id] = t
        val p = playlists.firstOrNull { it.id == id } ?: return
        if (p.tracks.any { it.id == t.id }) { say("Sudah ada di “${p.name}”"); return }
        playlists = playlists.map { if (it.id == id) it.copy(tracks = it.tracks + t) else it }
        savePlaylists()
        say("Ditambahkan ke “${p.name}”")
    }

    fun removeFromPlaylist(id: String, trackId: String) {
        playlists = playlists.map { if (it.id == id) it.copy(tracks = it.tracks.filter { t -> t.id != trackId }) else it }
        savePlaylists()
        say("Dihapus dari playlist")
    }

    fun renamePlaylist(id: String, name: String) {
        playlists = playlists.map { if (it.id == id) it.copy(name = name.trim().ifEmpty { it.name }.take(60)) else it }
        savePlaylists()
    }

    fun deletePlaylist(id: String) {
        val p = playlists.firstOrNull { it.id == id } ?: return
        playlists = playlists.filter { it.id != id }
        savePlaylists()
        say("Playlist “${p.name}” dihapus")
    }

    fun clearHistory() {
        history = emptyList()
        save("history", history)
        say("Riwayat dihapus")
    }

    // ---- Timer tidur & kecepatan ----

    /** `minutes` > 0: berhenti setelah sekian menit; -1: di akhir lagu ini; null: matikan. */
    fun setSleep(minutes: Int?) {
        sleepJob?.cancel()
        sleepAt = 0L
        sleepEndOfTrack = false
        when {
            minutes == null -> say("Timer tidur dimatikan")
            minutes < 0 -> { sleepEndOfTrack = true; say("Berhenti di akhir lagu ini") }
            else -> {
                sleepAt = System.currentTimeMillis() + minutes * 60_000L
                sleepJob = scope.launch {
                    delay(minutes * 60_000L)
                    controller?.pause()
                    sleepAt = 0L
                }
                say("Berhenti dalam $minutes menit")
            }
        }
    }

    fun changeSpeed(v: Float) {
        controller?.setPlaybackSpeed(v)
        speed = v
    }

    fun say(msg: String) {
        toast = msg
        toastJob?.cancel()
        toastJob = scope.launch { delay(2200); toast = null }
    }

    private fun trackJson(t: MusicTrack) = JSONObject().put("id", t.id).put("title", t.title).put("artist", t.artist).put("album", t.album).put("duration", t.duration ?: JSONObject.NULL).put("cover", t.cover)

    private fun save(key: String, list: List<MusicTrack>) {
        if (!::prefs.isInitialized) return
        val arr = JSONArray()
        list.forEach { arr.put(trackJson(it)) }
        prefs.edit().putString(key, arr.toString()).apply()
    }

    private fun savePlaylists() {
        if (!::prefs.isInitialized) return
        val arr = JSONArray()
        playlists.forEach { p -> arr.put(JSONObject().put("id", p.id).put("name", p.name).put("tracks", JSONArray().also { a -> p.tracks.forEach { a.put(trackJson(it)) } })) }
        prefs.edit().putString("playlists", arr.toString()).apply()
    }

    /** Posisi saat ini (ms); dibaca per frame oleh lirik & scrubber. */
    fun position(): Long = controller?.currentPosition ?: 0L

    private fun item(t: MusicTrack): MediaItem = MediaItem.Builder()
        .setMediaId(t.id)
        .setUri(MusicResolver.uri(t.id))
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(t.title)
                .setArtist(t.artist.ifEmpty { "JKT48" })
                .setAlbumTitle(t.album.ifEmpty { "JKT48Connect" })
                .setArtworkUri(Uri.parse(t.coverLarge.ifEmpty { t.cover }))
                .setIsPlayable(true)
                .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
                .build(),
        )
        .build()

    /** Lagu dari antrean service (bisa dari sesi sebelum aplikasi ditutup): pulihkan metadatanya. */
    private fun trackOf(m: MediaItem): MusicTrack = known[m.mediaId] ?: MusicTrack(
        m.mediaId,
        m.mediaMetadata.title?.toString().orEmpty(),
        m.mediaMetadata.artist?.toString().orEmpty(),
        "",
        null,
        m.mediaMetadata.artworkUri?.toString()?.replace("/maxresdefault.jpg", "/hqdefault.jpg").orEmpty(),
    ).also { known[it.id] = it }

    private fun sync(c: Player) {
        queue = (0 until c.mediaItemCount).map { trackOf(c.getMediaItemAt(it)) }
        index = c.currentMediaItemIndex
        val now = c.currentMediaItem?.let(::trackOf)
        if (now?.id != current?.id) onTrack(now)
        playing = c.isPlaying
        buffering = c.playbackState == Player.STATE_BUFFERING
        durationMs = c.duration.takeIf { it > 0 } ?: ((now?.duration ?: 0) * 1000L)
        shuffle = c.shuffleModeEnabled
        repeat = c.repeatMode
        speed = c.playbackParameters.speed
    }

    private fun onTrack(t: MusicTrack?) {
        current = t
        retriedFor = null
        lyrics = null
        lyricsJob?.cancel()
        if (t == null) return
        addToHistory(t)
        lyricsLoading = true
        lyricsJob = scope.launch {
            lyrics = runCatching { Api.lyrics(t.id) }.getOrDefault(Lyrics.None)
            lyricsLoading = false
        }
    }

    private fun addToHistory(t: MusicTrack) {
        history = (listOf(t) + history.filter { it.id != t.id }).take(20)
        save("history", history)
    }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = sync(player)

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            // Timer "akhir lagu": lagu selesai sendiri (lanjut/ulang) → jeda di awal lagu berikutnya.
            if (sleepEndOfTrack && (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)) {
                controller?.pause()
                sleepEndOfTrack = false
            }
        }

        override fun onPlayerError(e: PlaybackException) {
            val c = controller ?: return
            val id = c.currentMediaItem?.mediaId ?: return
            // URL audio kedaluwarsa / gagal sementara: resolve ulang sekali lalu lanjut dari posisi yang sama.
            if (retriedFor != id) {
                retriedFor = id
                MusicResolver.invalidate(id)
                val pos = c.currentPosition
                c.prepare()
                c.seekTo(pos)
                c.play()
            } else {
                error = "Lagu ini belum bisa diputar. Coba lagu lain."
                if (c.hasNextMediaItem()) c.seekToNextMediaItem()
            }
        }
    }
}

/** Playlist buatan pengguna. */
data class Playlist(val id: String, val name: String, val tracks: List<MusicTrack>) {
    companion object {
        fun from(j: JSONObject) = Playlist(
            j.optString("id"),
            j.optString("name"),
            (j.optJSONArray("tracks") ?: JSONArray()).objects().map(MusicTrack::from),
        )
    }
}

/** Lembar aksi musik. `from` = id koleksi asal ("liked" / id playlist) supaya menu bisa menawarkan "hapus dari sini". */
sealed interface MusicSheet {
    data class Track(val track: MusicTrack, val from: String? = null, val queueIndex: Int? = null, val player: Boolean = false) : MusicSheet
    data class AddTo(val track: MusicTrack) : MusicSheet
    data class NewPlaylist(val track: MusicTrack?) : MusicSheet
    data class Rename(val playlist: Playlist) : MusicSheet
    data object Sleep : MusicSheet
    data object Speed : MusicSheet
}
