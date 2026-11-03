package app.jkt48connect.core

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.compose.runtime.getValue
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

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.getSharedPreferences("music", Context.MODE_PRIVATE)
        history = runCatching { JSONArray(prefs.getString("history", "[]")).objects().map(MusicTrack::from) }.getOrDefault(emptyList())
        history.forEach { known[it.id] = it }
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
        if (::prefs.isInitialized) {
            val arr = JSONArray()
            history.forEach {
                arr.put(JSONObject().put("id", it.id).put("title", it.title).put("artist", it.artist).put("album", it.album).put("duration", it.duration ?: JSONObject.NULL).put("cover", it.cover))
            }
            prefs.edit().putString("history", arr.toString()).apply()
        }
    }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = sync(player)

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
