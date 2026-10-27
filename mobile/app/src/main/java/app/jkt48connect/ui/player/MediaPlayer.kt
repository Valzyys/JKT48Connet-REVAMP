package app.jkt48connect.ui.player

import android.view.TextureView
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.HighQuality
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import app.jkt48connect.core.Api
import app.jkt48connect.core.parseInstant
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.screens.Spinner
import app.jkt48connect.ui.theme.AppText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Sumber video untuk [MediaPlayer].
 * - `hls`: playlist HLS (mulai & seek cepat); bila gagal, pemutar beralih ke `fallback` (MP4) bila ada.
 * - `auth`: kirim token aplikasi (hanya untuk URL worker sendiri, mis. replay). URL pihak lain (YouTube via
 *   api.jkt48connect.app, media TikTok/Instagram/X, CDN Showroom) diputar tanpa header supaya token tidak bocor.
 * - `qualities`: tinggi video yang tersedia dalam satu playlist (YouTube), memunculkan pil kualitas.
 * - `live`: siaran langsung — tanpa seek/lompat/kecepatan; `liveSince` untuk lama siaran, `variants` untuk
 *   pilihan kualitas yang berupa playlist terpisah (Showroom: label → URL, kualitas tertinggi dulu).
 */
data class MediaSource(
    val url: String,
    val hls: Boolean = false,
    val fallback: String? = null,
    val auth: Boolean = false,
    val durationMs: Long = 0,
    val qualities: List<Int> = emptyList(),
    val live: Boolean = false,
    val liveSince: String = "",
    val variants: List<Pair<String, String>> = emptyList(),
)

/**
 * Jumlah pemutar video yang sedang tampil. Selama ada, kaca di kepala halaman hanya membiaskan latar ambient
 * (statis) — bukan isi halaman — supaya tiap frame video tidak memaksa efek kaca dihitung ulang (penyebab tersendat).
 */
object PlayerPresence {
    var count by mutableIntStateOf(0)
}

/** Status pemutar; dibagi antara tampilan di halaman dan layar penuh supaya ExoPlayer tidak dibuat ulang. */
@Stable
private class PlayerUi(ratio: Float, durationMs: Long) {
    var player by mutableStateOf<ExoPlayer?>(null)
    var error by mutableStateOf<String?>(null)
    var started by mutableStateOf(false)
    var playing by mutableStateOf(false)
    var buffering by mutableStateOf(true)
    var ended by mutableStateOf(false)
    var ratio by mutableFloatStateOf(ratio)
    var position by mutableLongStateOf(0L)
    var duration by mutableLongStateOf(durationMs)
    var dragging by mutableStateOf<Float?>(null)
    var controls by mutableStateOf(true)
    var lastTouch by mutableLongStateOf(System.currentTimeMillis())
    var speed by mutableFloatStateOf(1f)
    var fullscreen by mutableStateOf(false)
    /** 0 = otomatis (adaptif), selain itu tinggi video yang dikunci. */
    var quality by mutableIntStateOf(0)
    /** Indeks `MediaSource.variants` yang diputar (live Showroom). */
    var variant by mutableIntStateOf(0)

    fun wake() {
        controls = true
        lastTouch = System.currentTimeMillis()
    }

    fun toggle() {
        player?.let {
            if (it.isPlaying) it.pause() else {
                if (it.playbackState == Player.STATE_ENDED) it.seekTo(0)
                it.play()
            }
        }
        wake()
    }

    fun seekBy(ms: Long) {
        player?.let {
            val max = if (duration > 0) duration else Long.MAX_VALUE
            it.seekTo((it.currentPosition + ms).coerceIn(0, max))
            position = it.currentPosition
        }
        wake()
    }

    /** Live: kembali ke posisi terkini siaran (mis. setelah dijeda). */
    fun goLive() {
        player?.let {
            it.seekToDefaultPosition()
            it.play()
        }
        wake()
    }

    fun nextSpeed() {
        val speeds = listOf(1f, 1.25f, 1.5f, 2f, 0.5f, 0.75f)
        speed = speeds[(speeds.indexOf(speed) + 1) % speeds.size]
        player?.setPlaybackSpeed(speed)
        wake()
    }

    /** Otomatis → kualitas tertinggi → … → terendah → otomatis. */
    fun nextQuality(options: List<Int>) {
        val order = listOf(0) + options.sortedDescending()
        quality = order[(order.indexOf(quality) + 1) % order.size]
        player?.let { p ->
            val b = p.trackSelectionParameters.buildUpon()
            p.trackSelectionParameters = if (quality == 0) b.clearVideoSizeConstraints().build()
            else b.setMaxVideoSize(Int.MAX_VALUE, quality).setMinVideoSize(0, quality).build()
        }
        wake()
    }
}

/**
 * Pemutar video (Media3): judul, kecepatan, kualitas, layar penuh, mundur/maju 10 detik, play, dan bar posisi.
 * Ketuk dua kali di sisi kiri/kanan untuk −10/+10 detik. Mode live: lencana LIVE + lama siaran, tanpa seek.
 *
 * Kontrol sengaja tidak memakai kaca (backdrop): kaca di atas video harus menghitung ulang blur/refraksi
 * setiap frame video dan membuat video patah-patah di banyak HP.
 * `onFatal`: dipanggil saat video tidak bisa diputar (mis. tiket HLS kedaluwarsa → pemanggil mengambil URL baru).
 */
@OptIn(UnstableApi::class)
@Composable
fun MediaPlayer(
    src: MediaSource,
    title: String,
    label: String,
    modifier: Modifier = Modifier,
    ratio: Float = 16f / 9f,
    poster: String = "",
    autoplay: Boolean = false,
    radius: Dp = 22.dp,
    /** false = tidak terlihat (mis. halaman lain di pager): video dijeda. */
    active: Boolean = true,
    onFatal: ((String) -> Unit)? = null,
) {
    val context = LocalContext.current
    val ui = remember { PlayerUi(ratio, src.durationMs) }
    LaunchedEffect(active, ui.player) { if (!active) ui.player?.pause() }

    LaunchedEffect(src.url) {
        val headers = if (src.auth) runCatching { Api.authHeaders() }.getOrElse { emptyMap() } else emptyMap()
        val source = DefaultHttpDataSource.Factory()
            .setDefaultRequestProperties(headers)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
        // Live: setelah tersendat tunggu ±3 detik cadangan dulu supaya tidak langsung tersendat lagi.
        // VOD: mulai cepat (1 detik), lalu isi cadangan sampai 50 detik ke depan.
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(if (src.live) 4_000 else 15_000, if (src.live) 30_000 else 50_000, 1_000, if (src.live) 3_000 else 2_500)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        val exo = ExoPlayer.Builder(context, DefaultRenderersFactory(context).setEnableDecoderFallback(true))
            .setMediaSourceFactory(DefaultMediaSourceFactory(source))
            .setLoadControl(load)
            .setHandleAudioBecomingNoisy(true)
            .build()
        exo.setAudioAttributes(androidx.media3.common.AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
        var usingHls = src.hls
        var loadedVariant = -1
        fun load() {
            val variantUrl = src.variants.getOrNull(ui.variant)?.second
            val url = variantUrl ?: if (usingHls || src.fallback == null) src.url else src.fallback
            val item = MediaItem.Builder().setUri(Api.absolute(url))
            if (usingHls || src.live) item.setMimeType(MimeTypes.APPLICATION_M3U8)
            if (src.live) {
                // Playlist Showroom hanya ±3 detik. Jangan dipercepat untuk mengejar ujung siaran (itu
                // menghabiskan cadangan → tersendat lagi); cukup sedikit diperlambat bila terlalu dekat ujung.
                item.setLiveConfiguration(
                    MediaItem.LiveConfiguration.Builder()
                        .setTargetOffsetMs(6_000)
                        .setMinOffsetMs(2_000)
                        .setMaxOffsetMs(45_000)
                        .setMinPlaybackSpeed(0.97f)
                        .setMaxPlaybackSpeed(1f)
                        .build(),
                )
            }
            loadedVariant = ui.variant
            exo.setMediaItem(item.build())
            exo.prepare()
        }
        exo.addListener(object : Player.Listener {
            override fun onPlayerError(e: PlaybackException) {
                when {
                    usingHls && src.fallback != null -> {
                        usingHls = false // HLS gagal → MP4 biasa
                        load()
                    }
                    // Live tertinggal dari jendela playlist (mis. lama dijeda): lompat ke posisi terkini.
                    e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW -> {
                        exo.seekToDefaultPosition()
                        exo.prepare()
                    }
                    else -> {
                        val msg = e.localizedMessage ?: "Video belum bisa diputar"
                        ui.error = msg
                        onFatal?.invoke(msg)
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                ui.playing = isPlaying
                if (isPlaying) ui.started = true
            }

            override fun onPlaybackStateChanged(state: Int) {
                ui.buffering = state == Player.STATE_BUFFERING
                ui.ended = state == Player.STATE_ENDED
                if (state == Player.STATE_ENDED) ui.wake()
                if (exo.duration > 0 && !src.live) ui.duration = exo.duration
            }

            override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
                if (size.width > 0 && size.height > 0) ui.ratio = size.width * size.pixelWidthHeightRatio / size.height
            }
        })
        load()
        exo.playWhenReady = autoplay
        ui.player = exo
        while (true) {
            if (loadedVariant != ui.variant) {
                ui.error = null
                load()
                exo.play()
            }
            // Posisi hanya dibaca saat kontrol tampil: tidak ada rekomposisi tiap 250 ms selama menonton.
            if (ui.dragging == null && (ui.controls || !ui.playing)) ui.position = exo.currentPosition
            if (exo.isPlaying && System.currentTimeMillis() - ui.lastTouch > 3000) ui.controls = false
            delay(250)
        }
    }
    DisposableEffect(Unit) {
        PlayerPresence.count++
        onDispose {
            PlayerPresence.count--
            ui.player?.release()
        }
    }
    // Aplikasi ke latar → jeda; layar tetap menyala selama video diputar.
    val lifecycle = (context as? androidx.activity.ComponentActivity)?.lifecycle
    DisposableEffect(lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, e -> if (e == androidx.lifecycle.Lifecycle.Event.ON_PAUSE) ui.player?.pause() }
        lifecycle?.addObserver(observer)
        onDispose { lifecycle?.removeObserver(observer) }
    }
    val view = LocalView.current
    DisposableEffect(ui.playing) {
        view.keepScreenOn = ui.playing
        onDispose { view.keepScreenOn = false }
    }

    val maxH = LocalConfiguration.current.screenHeightDp.dp * 0.62f
    Column(modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(max = maxH)
                .aspectRatio(ui.ratio, matchHeightConstraintsFirst = ui.ratio < 1f)
                .clip(RoundedCornerShape(radius))
                .background(Color.Black),
            contentAlignment = Alignment.Center,
        ) {
            if (!ui.fullscreen) {
                PlayerSurface(ui, src, title, label, poster, fullscreen = false)
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Image(Icons.Rounded.Fullscreen, null, Modifier.size(28.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.6f)))
                    VGap(6.dp)
                    Txt("Diputar di layar penuh", AppText.body(13.sp, Color.White.copy(alpha = 0.6f)))
                }
            }
        }
    }
    if (ui.fullscreen) FullscreenPlayer(ui, src, title, label)
}

/** Video + kontrol; dipakai di halaman (membulat) maupun layar penuh. */
@Composable
private fun PlayerSurface(ui: PlayerUi, src: MediaSource, title: String, label: String, poster: String, fullscreen: Boolean) {
    // Kilasan "−10 / +10 detik" saat ketuk dua kali di sisi kiri/kanan.
    var flash by remember { mutableIntStateOf(0) }
    var flashTick by remember { mutableIntStateOf(0) }
    LaunchedEffect(flashTick) {
        if (flashTick > 0) {
            delay(650)
            flash = 0
        }
    }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(ui, src.live) {
                detectTapGestures(
                    onTap = { if (ui.controls && ui.playing) ui.controls = false else ui.wake() },
                    onDoubleTap = { off ->
                        if (src.live) return@detectTapGestures
                        val forward = off.x > size.width / 2
                        ui.seekBy(if (forward) 10_000 else -10_000)
                        flash = if (forward) 1 else -1
                        flashTick++
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            // Video selalu utuh (fit) di dalam wadah.
            val boxRatio = if (maxHeight.value > 0f) maxWidth.value / maxHeight.value else ui.ratio
            val videoModifier = if (boxRatio > ui.ratio) Modifier.fillMaxHeight().aspectRatio(ui.ratio, matchHeightConstraintsFirst = true)
            else Modifier.fillMaxWidth().aspectRatio(ui.ratio)
            ui.player?.let { p ->
                AndroidView(
                    factory = { TextureView(it).also { v -> p.setVideoTextureView(v) } },
                    modifier = videoModifier,
                    onRelease = { p.clearVideoTextureView(it) },
                )
            }
            // Gambar sampul sampai video benar-benar mulai.
            if (poster.isNotEmpty() && !ui.started) NetImage(poster, Modifier.fillMaxSize(), alignment = Alignment.Center)
        }
        when {
            ui.error != null -> Txt(
                if (src.live) "Siaran belum bisa diputar." else "Video belum bisa diputar.\n${ui.error}",
                AppText.body(13.sp, Color.White.copy(alpha = 0.75f)),
                Modifier.background(Color.Black.copy(alpha = 0.6f)).padding(20.dp),
            )
            ui.ended && src.live -> Txt("Siaran sudah selesai.", AppText.body(14.sp, Color.White, 700), Modifier.background(Color.Black.copy(alpha = 0.6f)).padding(20.dp))
            ui.buffering && (ui.started || ui.player?.playWhenReady == true) -> Spinner()
        }
        if (flash != 0) {
            Box(Modifier.fillMaxSize(), contentAlignment = if (flash > 0) Alignment.CenterEnd else Alignment.CenterStart) {
                Column(
                    Modifier.fillMaxHeight().fillMaxWidth(0.38f)
                        .background(Brush.horizontalGradient(if (flash > 0) listOf(Color.Transparent, Color.White.copy(alpha = 0.16f)) else listOf(Color.White.copy(alpha = 0.16f), Color.Transparent))),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Image(if (flash > 0) Icons.Rounded.Forward10 else Icons.Rounded.Replay10, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(Color.White))
                    Txt(if (flash > 0) "+10 detik" else "−10 detik", AppText.mono(12.sp, Color.White, FontWeight.SemiBold))
                }
            }
        }
        AnimatedVisibility(ui.controls || !ui.playing, enter = fadeIn(tween(160)), exit = fadeOut(tween(220)), modifier = Modifier.fillMaxSize()) {
            PlayerControls(ui, src, title, label, fullscreen)
        }
    }
}

private val Scrim = Color.Black.copy(alpha = 0.42f)

@Composable
private fun RoundButton(icon: androidx.compose.ui.graphics.vector.ImageVector, size: Dp, desc: String, filled: Boolean = false, onClick: () -> Unit) {
    Box(
        Modifier.size(size).clip(CircleShape).background(if (filled) Color.White.copy(alpha = 0.92f) else Scrim).pressable(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Image(icon, desc, Modifier.size(size * 0.5f), colorFilter = ColorFilter.tint(if (filled) Color.Black else Color.White))
    }
}

@Composable
private fun Pill(icon: androidx.compose.ui.graphics.vector.ImageVector?, text: String, height: Dp, color: Color = Scrim, onClick: () -> Unit) {
    Row(
        Modifier.height(height).clip(CircleShape).background(color).pressable(onClick).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (icon != null) Image(icon, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(Color.White))
        Txt(text, AppText.mono(11.5.sp, Color.White, FontWeight.SemiBold))
    }
}

@Composable
private fun PlayerControls(ui: PlayerUi, src: MediaSource, title: String, label: String, fullscreen: Boolean) {
    val small = if (fullscreen) 44.dp else 36.dp
    val side = if (fullscreen) 56.dp else 46.dp
    val play = if (fullscreen) 80.dp else 64.dp
    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.6f), 0.28f to Color.Transparent, 0.62f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.75f)))
            .then(if (fullscreen) Modifier.windowInsetsPadding(WindowInsets.safeDrawing) else Modifier),
    ) {
        Row(
            Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(if (fullscreen) 18.dp else 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Txt(title, AppText.body(if (fullscreen) 16.sp else 13.sp, Color.White, 800), maxLines = 1)
                Txt(label, AppText.micro(Color.White.copy(alpha = 0.6f), 8.5.sp))
            }
            if (src.variants.size > 1) {
                Pill(Icons.Rounded.HighQuality, src.variants.getOrNull(ui.variant)?.first ?: "Auto", small) {
                    ui.variant = (ui.variant + 1) % src.variants.size
                    ui.wake()
                }
            }
            if (src.qualities.size > 1) Pill(Icons.Rounded.HighQuality, if (ui.quality == 0) "Auto" else "${ui.quality}p", small) { ui.nextQuality(src.qualities) }
            if (!src.live) Pill(Icons.Rounded.Speed, if (ui.speed % 1f == 0f) "${ui.speed.toInt()}×" else "${ui.speed}×".replace('.', ','), small) { ui.nextSpeed() }
            RoundButton(if (fullscreen) Icons.Rounded.FullscreenExit else Icons.Rounded.Fullscreen, small, if (fullscreen) "Keluar layar penuh" else "Layar penuh") {
                ui.fullscreen = !ui.fullscreen
                ui.wake()
            }
        }
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (fullscreen) 36.dp else 22.dp)) {
            if (!src.live) RoundButton(Icons.Rounded.Replay10, side, "Mundur 10 detik") { ui.seekBy(-10_000) }
            RoundButton(
                when {
                    ui.ended && !src.live -> Icons.Rounded.Replay
                    ui.playing -> Icons.Rounded.Pause
                    else -> Icons.Rounded.PlayArrow
                },
                play,
                if (ui.playing) "Jeda" else "Putar",
                filled = true,
            ) { ui.toggle() }
            if (!src.live) RoundButton(Icons.Rounded.Forward10, side, "Maju 10 detik") { ui.seekBy(10_000) }
        }
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = if (fullscreen) 22.dp else 12.dp, vertical = if (fullscreen) 14.dp else 8.dp)) {
            if (src.live) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Pill(null, "● LIVE", small, Color(0xFFE1243A)) { ui.goLive() }
                    Spacer(Modifier.width(10.dp))
                    if (src.liveSince.isNotEmpty()) LiveClock(src.liveSince)
                }
            } else {
                ScrubBar(
                    value = { ui.dragging ?: if (ui.duration > 0) (ui.position.toFloat() / ui.duration).coerceIn(0f, 1f) else 0f },
                    onDrag = {
                        ui.dragging = it
                        ui.wake()
                    },
                    onDone = { v ->
                        ui.player?.seekTo((v * ui.duration).toLong())
                        ui.position = (v * ui.duration).toLong()
                        ui.dragging = null
                        ui.wake()
                    },
                )
                Row {
                    Txt(time(ui.dragging?.let { (it * ui.duration).toLong() } ?: ui.position), AppText.mono(11.sp, Color.White, FontWeight.SemiBold))
                    Spacer(Modifier.weight(1f))
                    Txt("-" + time((ui.duration - (ui.dragging?.let { (it * ui.duration).toLong() } ?: ui.position)).coerceAtLeast(0)), AppText.mono(11.sp, Color.White.copy(alpha = 0.65f)))
                }
            }
        }
    }
}

/**
 * Bar posisi ringan: digambar langsung (tanpa kaca) dan nilainya dibaca saat menggambar, jadi geser/maju
 * hanya menggambar ulang bar ini. Ketuk untuk lompat, geser untuk mencari.
 */
@Composable
private fun ScrubBar(value: () -> Float, onDrag: (Float) -> Unit, onDone: (Float) -> Unit) {
    var last by remember { mutableFloatStateOf(0f) }
    Box(
        Modifier
            .fillMaxWidth()
            .height(28.dp)
            .pointerInput(Unit) {
                detectTapGestures { off -> onDone((off.x / size.width).coerceIn(0f, 1f)) }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { off ->
                        last = (off.x / size.width).coerceIn(0f, 1f)
                        onDrag(last)
                    },
                    onDragEnd = { onDone(last) },
                    onDragCancel = { onDone(last) },
                ) { change, _ ->
                    change.consume()
                    last = (change.position.x / size.width).coerceIn(0f, 1f)
                    onDrag(last)
                }
            }
            .drawBehind {
                val h = 4.dp.toPx()
                val y = size.height / 2 - h / 2
                val v = value().coerceIn(0f, 1f)
                drawRoundRect(Color.White.copy(alpha = 0.25f), Offset(0f, y), Size(size.width, h), CornerRadius(h / 2))
                drawRoundRect(Color(0xFFE1243A), Offset(0f, y), Size(size.width * v, h), CornerRadius(h / 2))
                drawCircle(Color.White, 7.dp.toPx(), Offset(size.width * v, size.height / 2))
            },
    )
}

/** Lama siaran berjalan, diperbarui tiap detik. */
@Composable
private fun LiveClock(since: String) {
    val start = remember(since) { parseInstant(since)?.toEpochMilli() }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    if (start != null) Txt(time((now - start).coerceAtLeast(0)), AppText.mono(12.sp, Color.White.copy(alpha = 0.85f), FontWeight.SemiBold))
}

/**
 * Layar penuh di jendela terpisah: bilah sistem disembunyikan, video lanskap memutar layar ke lanskap.
 * Tombol kembali, tombol keluar, atau geser ke bawah untuk kembali ke halaman.
 */
@Composable
private fun FullscreenPlayer(ui: PlayerUi, src: MediaSource, title: String, label: String) {
    val activity = androidx.activity.compose.LocalActivity.current
    val scope = rememberCoroutineScope()
    Dialog(
        onDismissRequest = { ui.fullscreen = false },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false),
    ) {
        val view = LocalView.current
        val window = (view.parent as? DialogWindowProvider)?.window
        DisposableEffect(window) {
            window?.let { w ->
                w.setLayout(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT)
                w.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(android.graphics.Color.BLACK))
                if (android.os.Build.VERSION.SDK_INT >= 28) {
                    w.attributes = w.attributes.apply { layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES }
                }
                hideSystemBars(w)
            }
            val before = activity?.requestedOrientation ?: android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            if (ui.ratio > 1f) activity?.requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            onDispose { activity?.requestedOrientation = before }
        }
        val drag = remember { Animatable(0f) }
        val exitPx = with(LocalDensity.current) { 120.dp.toPx() }
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
                .graphicsLayer { translationY = drag.value }
                .pointerInput(Unit) {
                    detectVerticalDragGestures(
                        onDragEnd = { scope.launch { if (drag.value > exitPx) ui.fullscreen = false else drag.animateTo(0f, spring(0.75f, 400f)) } },
                        onDragCancel = { scope.launch { drag.animateTo(0f) } },
                    ) { change, amount ->
                        change.consume()
                        scope.launch { drag.snapTo((drag.value + amount).coerceAtLeast(0f)) }
                    }
                },
        ) {
            PlayerSurface(ui, src, title, label, poster = "", fullscreen = true)
        }
    }
}

@Suppress("DEPRECATION")
private fun hideSystemBars(w: android.view.Window) {
    if (android.os.Build.VERSION.SDK_INT >= 30) {
        w.insetsController?.let {
            it.hide(android.view.WindowInsets.Type.systemBars())
            it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    } else {
        w.decorView.systemUiVisibility = (android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
    }
}

fun time(ms: Long): String {
    val s = ms / 1000
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%02d:%02d".format(s / 60, s % 60)
}
