package app.jkt48connect.core

import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.BitmapLoader
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSourceBitmapLoader
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.CacheBitmapLoader
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import app.jkt48connect.MainActivity
import app.jkt48connect.R
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import kotlinx.coroutines.runBlocking
import java.io.IOException

/**
 * URL audio lagu bertanda tangan & kedaluwarsa beberapa jam, jadi antrean memakai URI `jkc-music://<id>` yang
 * di-resolve tepat saat diputar (dan diperbarui bila hampir kedaluwarsa). Dipakai oleh [MusicService].
 */
object MusicResolver {
    const val SCHEME = "jkc-music"
    private val cache = HashMap<String, MusicAudio>()

    fun uri(id: String): Uri = Uri.parse("$SCHEME://$id")

    fun invalidate(id: String) = synchronized(cache) { cache.remove(id) }

    /** Dipanggil di thread pemuat ExoPlayer (bukan main thread), jadi boleh memblokir. */
    @OptIn(UnstableApi::class)
    fun resolve(spec: DataSpec): DataSpec {
        if (spec.uri.scheme != SCHEME) return spec
        val id = spec.uri.host ?: throw IOException("Lagu tidak valid")
        val now = System.currentTimeMillis() / 1000
        val cached = synchronized(cache) { cache[id] }?.takeIf { (it.expiresAt ?: Long.MAX_VALUE) - now > 600 }
        val audio = cached ?: runBlocking {
            val fresh = runCatching { Api.music(id) }.getOrNull()?.audio?.takeIf { (it.expiresAt ?: Long.MAX_VALUE) - now > 600 }
            fresh ?: Api.music(id, Fetch.Force).audio
        } ?: throw IOException("Audio lagu belum tersedia")
        synchronized(cache) { cache[id] = audio }
        return spec.withUri(Uri.parse(audio.url))
    }
}

/** Cover YouTube maxres tidak selalu ada: jatuh ke mqdefault (16:9 tanpa garis hitam). */
@OptIn(UnstableApi::class)
private class CoverBitmapLoader(private val inner: BitmapLoader) : BitmapLoader {
    override fun supportsMimeType(mimeType: String) = inner.supportsMimeType(mimeType)
    override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> = inner.decodeBitmap(data)
    override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> {
        val fallback = uri.toString().replace("/maxresdefault.jpg", "/mqdefault.jpg")
        if (fallback == uri.toString()) return inner.loadBitmap(uri)
        return Futures.catchingAsync(inner.loadBitmap(uri), Throwable::class.java, { inner.loadBitmap(Uri.parse(fallback)) }, MoreExecutors.directExecutor())
    }
}

/**
 * Pemutaran musik di latar: tetap berbunyi saat aplikasi ditutup/di-swipe dari recent, dengan kontrol di
 * notifikasi media, layar kunci, earphone/Bluetooth, dan panel media Android (judul, artis, cover, progres).
 */
@OptIn(UnstableApi::class)
class MusicService : MediaSessionService() {
    private var session: MediaSession? = null

    private val shuffle = SessionCommand("jkc.shuffle", Bundle.EMPTY)
    private val repeat = SessionCommand("jkc.repeat", Bundle.EMPTY)

    /** Tombol tambahan di notifikasi media & panel media Android: Acak dan Ulangi (ikonnya mengikuti status). */
    private fun buttons(p: Player) = listOf(
        CommandButton.Builder(if (p.shuffleModeEnabled) CommandButton.ICON_SHUFFLE_ON else CommandButton.ICON_SHUFFLE_OFF)
            .setDisplayName("Acak")
            .setSessionCommand(shuffle)
            .setSlots(CommandButton.SLOT_BACK_SECONDARY)
            .build(),
        CommandButton.Builder(
            when (p.repeatMode) {
                Player.REPEAT_MODE_ONE -> CommandButton.ICON_REPEAT_ONE
                Player.REPEAT_MODE_ALL -> CommandButton.ICON_REPEAT_ALL
                else -> CommandButton.ICON_REPEAT_OFF
            },
        )
            .setDisplayName("Ulangi")
            .setSessionCommand(repeat)
            .setSlots(CommandButton.SLOT_FORWARD_SECONDARY)
            .build(),
    )

    private val callback = object : MediaSession.Callback {
        override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult =
            MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().add(shuffle).add(repeat).build())
                .setMediaButtonPreferences(buttons(session.player))
                .build()

        override fun onCustomCommand(session: MediaSession, controller: MediaSession.ControllerInfo, customCommand: SessionCommand, args: Bundle): ListenableFuture<SessionResult> {
            val p = session.player
            when (customCommand.customAction) {
                shuffle.customAction -> p.shuffleModeEnabled = !p.shuffleModeEnabled
                repeat.customAction -> p.repeatMode = when (p.repeatMode) {
                    Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                    Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                    else -> Player.REPEAT_MODE_OFF
                }
            }
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
    }

    override fun onCreate() {
        super.onCreate()
        Api.init(this)
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent("JKT48Connect-Android")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
        val source = ResolvingDataSource.Factory(DefaultDataSource.Factory(this, http)) { MusicResolver.resolve(it) }
        val player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(source))
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        val open = PendingIntent.getActivity(
            this,
            48,
            Intent(this, MainActivity::class.java).putExtra(Notify.EXTRA_OPEN, "music").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        session = MediaSession.Builder(this, player)
            .setCallback(callback)
            .setMediaButtonPreferences(buttons(player))
            .setSessionActivity(open)
            .setBitmapLoader(CacheBitmapLoader(CoverBitmapLoader(DataSourceBitmapLoader(this))))
            .build()
        // Ikon Acak/Ulangi di notifikasi ikut berubah, baik diubah dari notifikasi maupun dari aplikasi.
        player.addListener(object : Player.Listener {
            override fun onShuffleModeEnabledChanged(enabled: Boolean) { session?.setMediaButtonPreferences(buttons(player)) }
            override fun onRepeatModeChanged(mode: Int) { session?.setMediaButtonPreferences(buttons(player)) }
        })
        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this)
                .setChannelId("music")
                .setChannelName(R.string.music_channel)
                .build()
                .apply { setSmallIcon(R.drawable.ic_stat_music) },
        )
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

    /** Di-swipe dari recent: tetap jalan bila sedang memutar; bila dijeda/kosong, service berhenti. */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = session?.player
        if (p == null || !p.playWhenReady || p.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }
}
