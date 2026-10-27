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
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import app.jkt48connect.core.Api
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LiquidSlider
import app.jkt48connect.ui.screens.Spinner
import app.jkt48connect.ui.theme.AppText
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Sumber video untuk [MediaPlayer].
 * - `hls`: playlist HLS (mulai & seek cepat); bila gagal, pemutar beralih ke `fallback` (MP4) bila ada.
 * - `auth`: kirim token aplikasi (hanya untuk URL worker sendiri, mis. replay). URL pihak lain (YouTube via
 *   api.jkt48connect.app, media TikTok/Instagram/X) diputar tanpa header supaya token tidak bocor.
 * - `qualities`: tinggi video yang tersedia (YouTube), memunculkan pil kualitas.
 */
data class MediaSource(
    val url: String,
    val hls: Boolean = false,
    val fallback: String? = null,
    val auth: Boolean = false,
    val durationMs: Long = 0,
    val qualities: List<Int> = emptyList(),
)

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
 * Pemutar video (Media3) dengan kontrol kaca: judul, kecepatan, kualitas, layar penuh, mundur/maju 10 detik,
 * play, dan slider lensa. Ketuk dua kali di sisi kiri/kanan untuk −10/+10 detik.
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
        val source = DefaultHttpDataSource.Factory().setDefaultRequestProperties(headers).setAllowCrossProtocolRedirects(true)
        val exo = ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(source)).build()
        var usingHls = src.hls
        fun load() {
            val url = if (usingHls || src.fallback == null) src.url else src.fallback
            val item = MediaItem.Builder().setUri(Api.absolute(url))
            if (usingHls) item.setMimeType(MimeTypes.APPLICATION_M3U8)
            exo.setMediaItem(item.build())
            exo.prepare()
        }
        exo.addListener(object : Player.Listener {
            override fun onPlayerError(e: PlaybackException) {
                if (usingHls && src.fallback != null) {
                    usingHls = false // HLS gagal → MP4 biasa
                    load()
                } else {
                    val msg = e.localizedMessage ?: "Video belum bisa diputar"
                    ui.error = msg
                    onFatal?.invoke(msg)
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
                if (exo.duration > 0) ui.duration = exo.duration
            }

            override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
                if (size.width > 0 && size.height > 0) ui.ratio = size.width * size.pixelWidthHeightRatio / size.height
            }
        })
        load()
        exo.playWhenReady = autoplay
        ui.player = exo
        while (true) {
            if (ui.dragging == null) ui.position = exo.currentPosition
            if (exo.isPlaying && System.currentTimeMillis() - ui.lastTouch > 3000) ui.controls = false
            delay(250)
        }
    }
    DisposableEffect(Unit) { onDispose { ui.player?.release() } }
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
    Box(
        modifier
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
    if (ui.fullscreen) FullscreenPlayer(ui, src, title, label)
}

/** Video + kontrol; dipakai di halaman (membulat) maupun layar penuh. */
@Composable
private fun PlayerSurface(ui: PlayerUi, src: MediaSource, title: String, label: String, poster: String, fullscreen: Boolean) {
    val backdrop = rememberLayerBackdrop()
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
            .pointerInput(ui) {
                detectTapGestures(
                    onTap = { if (ui.controls && ui.playing) ui.controls = false else ui.wake() },
                    onDoubleTap = { off ->
                        val forward = off.x > size.width / 2
                        ui.seekBy(if (forward) 10_000 else -10_000)
                        flash = if (forward) 1 else -1
                        flashTick++
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        BoxWithConstraints(Modifier.fillMaxSize().layerBackdrop(backdrop), contentAlignment = Alignment.Center) {
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
            ui.error != null -> Txt("Video belum bisa diputar.\n${ui.error}", AppText.body(13.sp, Color.White.copy(alpha = 0.75f)), Modifier.background(Color.Black.copy(alpha = 0.6f)).padding(20.dp))
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
            PlayerControls(ui, src, title, label, fullscreen, backdrop)
        }
    }
}

@Composable
private fun PlayerControls(ui: PlayerUi, src: MediaSource, title: String, label: String, fullscreen: Boolean, backdrop: com.kyant.backdrop.Backdrop) {
    val small = if (fullscreen) 44.dp else 36.dp
    val side = if (fullscreen) 56.dp else 46.dp
    val play = if (fullscreen) 80.dp else 64.dp
    val glassFill = Color.White.copy(alpha = 0.14f)
    @Composable
    fun GlassIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, size: Dp, desc: String, onClick: () -> Unit) {
        LiquidButton(onClick = onClick, modifier = Modifier.size(size), backdrop = backdrop, fill = glassFill, contentPadding = PaddingValues(0.dp)) {
            Image(icon, desc, Modifier.size(size * 0.5f), colorFilter = ColorFilter.tint(Color.White))
        }
    }
    @Composable
    fun GlassPill(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, onClick: () -> Unit) {
        LiquidButton(onClick = onClick, modifier = Modifier.height(small), backdrop = backdrop, fill = glassFill, contentPadding = PaddingValues(horizontal = 10.dp)) {
            Image(icon, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(Color.White))
            Txt(text, AppText.mono(11.5.sp, Color.White, FontWeight.SemiBold))
        }
    }
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
            if (src.qualities.size > 1) GlassPill(Icons.Rounded.HighQuality, if (ui.quality == 0) "Auto" else "${ui.quality}p") { ui.nextQuality(src.qualities) }
            GlassPill(Icons.Rounded.Speed, if (ui.speed % 1f == 0f) "${ui.speed.toInt()}×" else "${ui.speed}×".replace('.', ',')) { ui.nextSpeed() }
            GlassIcon(if (fullscreen) Icons.Rounded.FullscreenExit else Icons.Rounded.Fullscreen, small, if (fullscreen) "Keluar layar penuh" else "Layar penuh") {
                ui.fullscreen = !ui.fullscreen
                ui.wake()
            }
        }
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (fullscreen) 36.dp else 22.dp)) {
            GlassIcon(Icons.Rounded.Replay10, side, "Mundur 10 detik") { ui.seekBy(-10_000) }
            LiquidIconButton(
                when {
                    ui.ended -> Icons.Rounded.Replay
                    ui.playing -> Icons.Rounded.Pause
                    else -> Icons.Rounded.PlayArrow
                },
                { ui.toggle() },
                size = play,
                iconSize = play * 0.5f,
                iconColor = Color.White,
                backdrop = backdrop,
                contentDescription = if (ui.playing) "Jeda" else "Putar",
            )
            GlassIcon(Icons.Rounded.Forward10, side, "Maju 10 detik") { ui.seekBy(10_000) }
        }
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = if (fullscreen) 22.dp else 12.dp, vertical = if (fullscreen) 14.dp else 6.dp)) {
            LiquidSlider(
                value = { if (ui.duration > 0) (ui.position.toFloat() / ui.duration).coerceIn(0f, 1f) else 0f },
                onValueChange = {
                    ui.dragging = it
                    ui.wake()
                },
                onValueChangeFinished = { v ->
                    ui.player?.seekTo((v * ui.duration).toLong())
                    ui.position = (v * ui.duration).toLong()
                    ui.dragging = null
                    ui.wake()
                },
                modifier = Modifier.fillMaxWidth(),
                backdrop = backdrop,
            )
            Row {
                Txt(time(ui.dragging?.let { (it * ui.duration).toLong() } ?: ui.position), AppText.mono(11.sp, Color.White, FontWeight.SemiBold))
                Spacer(Modifier.weight(1f))
                Txt("-" + time((ui.duration - (ui.dragging?.let { (it * ui.duration).toLong() } ?: ui.position)).coerceAtLeast(0)), AppText.mono(11.sp, Color.White.copy(alpha = 0.65f)))
            }
        }
    }
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
