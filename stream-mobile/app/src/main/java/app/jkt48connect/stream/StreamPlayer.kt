package app.jkt48connect.stream

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
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
import androidx.compose.ui.graphics.vector.ImageVector
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
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Sumber video dari server Stream (URL tiket yang terikat sesi, diputar dengan header Authorization). */
data class MediaSource(val url: String, val hls: Boolean, val live: Boolean = false, val liveSince: String = "")

/**
 * Jumlah pemutar yang sedang tampil. Selama ada, kaca bilah atas/tab bar hanya membiaskan latar ambient (diam),
 * bukan isi halaman, supaya tiap frame video tidak memaksa efek kaca dihitung ulang.
 */
object PlayerPresence {
    var count by mutableIntStateOf(0)
}

/** Status pemutar; dibagi antara tampilan di halaman dan layar penuh supaya ExoPlayer tidak dibuat ulang. */
@Stable
private class PlayerUi {
    var player by mutableStateOf<ExoPlayer?>(null)
    var error by mutableStateOf<String?>(null)
    var started by mutableStateOf(false)
    var playing by mutableStateOf(false)
    var buffering by mutableStateOf(true)
    var ended by mutableStateOf(false)
    var ratio by mutableFloatStateOf(16f / 9f)
    var position by mutableLongStateOf(0L)
    var duration by mutableLongStateOf(0L)
    var dragging by mutableStateOf<Float?>(null)
    var controls by mutableStateOf(true)
    var lastTouch by mutableLongStateOf(System.currentTimeMillis())
    var speed by mutableFloatStateOf(1f)
    var fullscreen by mutableStateOf(false)

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
}

/**
 * Pemutar Media3 dengan kontrol ala 2.6.1: judul, kecepatan, layar penuh, mundur/maju 10 detik, play, dan bar posisi.
 * Ketuk dua kali di sisi kiri/kanan untuk −10/+10 detik. Live: lencana LIVE + lama siaran, tanpa seek.
 * Kontrol sengaja tanpa kaca: kaca di atas video membuat tiap frame menghitung ulang blur dan video tersendat.
 * Panggil di dalam `key(src.url)` supaya URL baru membuat pemutar baru.
 */
@OptIn(UnstableApi::class)
@Composable
fun MediaPlayer(src: MediaSource, title: String, label: String, modifier: Modifier = Modifier, poster: String = "", onFatal: ((String) -> Unit)? = null) {
    val context = LocalContext.current
    val ui = remember { PlayerUi() }
    LaunchedEffect(Unit) {
        val scope = this
        val source = DefaultHttpDataSource.Factory()
            .setDefaultRequestProperties(mapOf("Authorization" to "Bearer ${StreamApi.token}"))
            .setAllowCrossProtocolRedirects(false)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
        // Live: tunggu ±5 detik cadangan setelah tersendat supaya tidak berhenti-jalan. VOD: mulai cepat lalu isi cadangan sampai 60 detik.
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(if (src.live) 8_000 else 20_000, if (src.live) 30_000 else 60_000, 1_500, 5_000)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        val exo = ExoPlayer.Builder(context, DefaultRenderersFactory(context).setEnableDecoderFallback(true))
            // Segmen/playlist yang gagal dimuat dicoba ulang lebih banyak sebelum dianggap error.
            .setMediaSourceFactory(DefaultMediaSourceFactory(source).setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(8)))
            .setLoadControl(load)
            .setHandleAudioBecomingNoisy(true)
            .build()
        exo.setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
        val item = MediaItem.Builder().setUri(src.url)
        if (src.hls || src.live) item.setMimeType(MimeTypes.APPLICATION_M3U8)
        if (src.live) {
            // Playlist live pendek: jangan dipercepat untuk mengejar ujung siaran, cukup sedikit diperlambat.
            item.setLiveConfiguration(
                MediaItem.LiveConfiguration.Builder()
                    .setTargetOffsetMs(10_000).setMinOffsetMs(4_000).setMaxOffsetMs(60_000)
                    .setMinPlaybackSpeed(0.97f).setMaxPlaybackSpeed(1f)
                    .build(),
            )
        }
        exo.addListener(object : Player.Listener {
            /** Pemulihan beruntun sejak terakhir kali video benar-benar berjalan. */
            var recoveries = 0

            override fun onPlayerError(error: PlaybackException) {
                // Jaringan/sumber tersendat (timeout, HTTP 5xx, playlist live belum lengkap): sambung ulang sendiri
                // dengan jeda bertahap, bukan berhenti. VOD lanjut dari posisi terakhir, live ke ujung siaran.
                val transient = error.errorCode == PlaybackException.ERROR_CODE_TIMEOUT ||
                    error.errorCode in 2000..2999 || (src.live && error.errorCode in 3000..3999)
                if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    exo.seekToDefaultPosition()
                    exo.prepare()
                } else if (transient && recoveries < 12) {
                    recoveries++
                    ui.buffering = true
                    scope.launch {
                        delay((recoveries * 1_000L).coerceAtMost(5_000L))
                        if (src.live) exo.seekToDefaultPosition()
                        exo.prepare()
                        exo.play()
                    }
                } else {
                    val msg = error.localizedMessage ?: "Video belum bisa diputar"
                    ui.error = msg
                    onFatal?.invoke(msg)
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                ui.playing = isPlaying
                if (isPlaying) {
                    ui.started = true
                    ui.error = null
                    recoveries = 0
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                ui.buffering = playbackState == Player.STATE_BUFFERING
                ui.ended = playbackState == Player.STATE_ENDED
                if (playbackState == Player.STATE_ENDED) ui.wake()
                if (exo.duration > 0 && !src.live) ui.duration = exo.duration
            }

            override fun onVideoSizeChanged(videoSize: VideoSize) {
                if (videoSize.width > 0 && videoSize.height > 0) ui.ratio = videoSize.width * videoSize.pixelWidthHeightRatio / videoSize.height
            }
        })
        exo.setMediaItem(item.build())
        exo.prepare()
        exo.playWhenReady = true
        ui.player = exo
        while (true) {
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
    Box(
        modifier
            .fillMaxWidth()
            .heightIn(max = maxH)
            .aspectRatio(ui.ratio, matchHeightConstraintsFirst = ui.ratio < 1f)
            .clip(RoundedCornerShape(22.dp))
            .background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        if (!ui.fullscreen) {
            PlayerSurface(ui, src, title, label, poster, fullscreen = false)
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Image(StreamIcons.Fullscreen, null, Modifier.size(28.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.6f)))
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
            if (poster.isNotEmpty() && !ui.started) Picture(poster, Modifier.fillMaxSize())
        }
        when {
            ui.error != null -> Txt(
                if (src.live) "Siaran belum bisa diputar." else "Video belum bisa diputar.",
                AppText.body(13.sp, Color.White.copy(alpha = 0.8f)),
                Modifier.background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(14.dp)).padding(16.dp),
            )
            ui.ended && src.live -> Txt("Siaran sudah selesai.", AppText.body(14.sp, Color.White, 700), Modifier.background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(14.dp)).padding(16.dp))
            ui.buffering && (ui.started || ui.player?.playWhenReady == true) -> Spinner(color = Color.White)
        }
        if (flash != 0) {
            Box(Modifier.fillMaxSize(), contentAlignment = if (flash > 0) Alignment.CenterEnd else Alignment.CenterStart) {
                Column(
                    Modifier.fillMaxHeight().fillMaxWidth(0.38f)
                        .background(Brush.horizontalGradient(if (flash > 0) listOf(Color.Transparent, Color.White.copy(alpha = 0.16f)) else listOf(Color.White.copy(alpha = 0.16f), Color.Transparent))),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Image(if (flash > 0) StreamIcons.Forward else StreamIcons.Rewind, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(Color.White))
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
private fun RoundButton(icon: ImageVector, size: Dp, desc: String, filled: Boolean = false, onClick: () -> Unit) {
    Box(
        Modifier.size(size).clip(CircleShape).background(if (filled) Color.White.copy(alpha = 0.92f) else Scrim).pressable(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Image(icon, desc, Modifier.size(size * 0.5f), colorFilter = ColorFilter.tint(if (filled) Color.Black else Color.White))
    }
}

@Composable
private fun ControlPill(text: String, height: Dp, color: Color = Scrim, onClick: () -> Unit) {
    Row(
        Modifier.height(height).clip(CircleShape).background(color).pressable(onClick).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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
                Txt(label.uppercase(), AppText.micro(Color.White.copy(alpha = 0.6f), 8.5.sp), maxLines = 1)
            }
            if (!src.live) ControlPill(if (ui.speed % 1f == 0f) "${ui.speed.toInt()}×" else "${ui.speed}×".replace('.', ','), small) { ui.nextSpeed() }
            RoundButton(if (fullscreen) StreamIcons.FullscreenExit else StreamIcons.Fullscreen, small, if (fullscreen) "Keluar layar penuh" else "Layar penuh") {
                ui.fullscreen = !ui.fullscreen
                ui.wake()
            }
        }
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (fullscreen) 36.dp else 22.dp)) {
            if (!src.live) RoundButton(StreamIcons.Rewind, side, "Mundur 10 detik") { ui.seekBy(-10_000) }
            RoundButton(if (ui.playing) StreamIcons.Pause else StreamIcons.Play, play, if (ui.playing) "Jeda" else "Putar", filled = true) { ui.toggle() }
            if (!src.live) RoundButton(StreamIcons.Forward, side, "Maju 10 detik") { ui.seekBy(10_000) }
        }
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = if (fullscreen) 22.dp else 12.dp, vertical = if (fullscreen) 14.dp else 8.dp)) {
            if (src.live) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ControlPill("● LIVE", small, Color(0xFFE1243A)) { ui.goLive() }
                    Gap(10.dp)
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
                    val at = ui.dragging?.let { (it * ui.duration).toLong() } ?: ui.position
                    Txt(clock(at), AppText.mono(11.sp, Color.White, FontWeight.SemiBold))
                    Spacer(Modifier.weight(1f))
                    Txt("-" + clock((ui.duration - at).coerceAtLeast(0)), AppText.mono(11.sp, Color.White.copy(alpha = 0.65f)))
                }
            }
        }
    }
}

/** Bar posisi ringan: digambar langsung, ketuk untuk lompat, geser untuk mencari. */
@Composable
private fun ScrubBar(value: () -> Float, onDrag: (Float) -> Unit, onDone: (Float) -> Unit) {
    var last by remember { mutableFloatStateOf(0f) }
    Box(
        Modifier
            .fillMaxWidth()
            .height(28.dp)
            .pointerInput(Unit) { detectTapGestures { off -> onDone((off.x / size.width).coerceIn(0f, 1f)) } }
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
    if (start != null) Txt(clock((now - start).coerceAtLeast(0)), AppText.mono(12.sp, Color.White.copy(alpha = 0.85f), FontWeight.SemiBold))
}

/** Layar penuh di jendela terpisah: bilah sistem disembunyikan, video lanskap memutar layar. Geser ke bawah untuk keluar. */
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

// ---------------------------------------------------------------- Halaman pemutar

/**
 * Halaman "sedang diputar": meminta sumber siaran ke server (tiket terikat sesi), memutar video,
 * lalu info, pilihan bagian rekaman, dan obrolan penonton untuk theater.
 * Bila live IDN belum punya sumber, tampil tombol membuka idn.app.
 */
@Composable
fun PlayerScreen(item: JSONObject) {
    val c = LocalColors.current
    val kind = item.optString("kind")
    val id = item.optString("id")
    val platform = item.optString("platform")
    var data by remember(id) { mutableStateOf<JSONObject?>(null) }
    var error by remember(id) { mutableStateOf("") }
    var attempt by remember(id) { mutableIntStateOf(0) }
    var part by remember(id) { mutableIntStateOf(0) }
    LaunchedEffect(id, attempt) {
        error = ""
        runCatching { StreamApi.request("/playback/$kind/${Uri.encode(id)}", "POST") }
            .onSuccess { data = it }
            .onFailure { error = it.message.orEmpty() }
    }
    val parts = data?.optJSONArray("items")?.rows().orEmpty()
    val current = parts.getOrNull(part)
    val title = item.optString("title")
    val label = when (kind) {
        "live" -> "Live · ${platformName(platform)}"
        "recent" -> "Replay · ${platformName(platform)}"
        else -> "Theater · JKT48"
    }
    val top = LocalInsets.current.calculateTopPadding()
    val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val open = rememberOpenUrl()
    val nav = LocalNav.current
    // Live: member lain yang sedang live, untuk pindah siaran tanpa kembali ke daftar.
    val others = if (kind == "live") rememberFeed("live", nav.reload, pollMs = 20_000L) { "/live" }.rows.filter { it.optString("id") != id } else emptyList()

    Column(Modifier.fillMaxSize().padding(top = top)) {
        Box(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
            when {
                current != null -> key(current.optString("url")) {
                    MediaPlayer(
                        MediaSource(current.optString("url"), current.optBoolean("hls"), live = kind == "live", liveSince = item.optString("date")),
                        title = title,
                        label = label,
                        poster = item.optString("image"),
                        // Sumber tetap gagal setelah disambung ulang → minta tiket/URL baru (maks. 3 kali).
                        onFatal = { if (attempt < 3) attempt++ },
                    )
                }
                error.isNotEmpty() -> Column(Modifier.fillMaxWidth().glassCard(22.dp).padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Micro(label, color = c.brand)
                    Txt(error, AppText.body(15.sp, c.ink, 600))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        GlassButton("Coba lagi", Modifier.weight(1f)) { attempt++ }
                        val link = item.optString("link")
                        if (platform == "idn" && link.startsWith("https://")) GlassButton("Buka idn.app", Modifier.weight(1f), StreamIcons.External, c.brand) { open(link) }
                    }
                }
                else -> Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(22.dp)).background(Color.Black), contentAlignment = Alignment.Center) {
                    Picture(item.optString("image"), Modifier.fillMaxSize().graphicsLayer { alpha = 0.45f })
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spinner(26.dp, Color.White)
                        VGap(10.dp)
                        Micro(if (kind == "live") "Menyiapkan siaran" else "Menyiapkan video", color = Color.White.copy(alpha = 0.8f))
                    }
                }
            }
        }
        if (kind == "theater") {
            Chat(id, title, label, item.optJSONArray("lineup")?.rows().orEmpty(), parts.size, part, { part = it }, Modifier.weight(1f), bottom)
        } else {
            LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = bottom + 24.dp)) {
                item { NowPlaying(item, label) }
                if (parts.size > 1) item { PartPicker(parts.size, part) { part = it } }
                item {
                    VGap(18.dp)
                    Txt(
                        if (kind == "live") "Ketuk ● LIVE untuk kembali ke posisi terkini siaran. Layar penuh memutar video lanskap otomatis."
                        else "Ketuk dua kali di sisi kiri/kanan video untuk mundur atau maju 10 detik.",
                        AppText.body(13.sp, c.inkSoft, 500, 1.45f),
                    )
                }
                if (others.isNotEmpty()) item {
                    VGap(22.dp)
                    Micro("Live lainnya · ${others.size}", color = c.brand)
                    VGap(10.dp)
                    Column(Modifier.fillMaxWidth().glassCard(24.dp)) {
                        others.forEachIndexed { i, l ->
                            if (i > 0) GroupDivider(70.dp)
                            GroupRow(
                                title = l.optString("title"),
                                subtitle = listOf(platformName(l.optString("platform")), timeAgo(l.optString("date"))).filter { it.isNotEmpty() }.joinToString(" · "),
                                leading = { Picture(l.optString("avatar").ifEmpty { l.optString("image") }, Modifier.size(44.dp).clip(CircleShape), alignment = Alignment.TopCenter, fallback = l.optString("title")) },
                                trailing = { Pill("Live", c.brand, Color.White) },
                                chevron = true,
                                onClick = {
                                    nav.pop()
                                    nav.push(Route.Watch(l))
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Info di bawah video: lencana, nama besar, dan keterangan waktu. */
@Composable
private fun NowPlaying(item: JSONObject, label: String) {
    val c = LocalColors.current
    val kind = item.optString("kind")
    Column(Modifier.padding(top = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (kind == "live" || item.optBoolean("isLive")) {
                Row(Modifier.background(c.brandGradient, CircleShape).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    SignalBars(color = Color.White, height = 10.dp)
                    Gap(6.dp)
                    Txt("LIVE", AppText.micro(Color.White, 9.5.sp))
                }
            }
            Micro(if (kind == "live") platformName(item.optString("platform")) else label)
        }
        VGap(8.dp)
        Txt(item.optString("title").uppercase(), AppText.display(32.sp, c.ink))
        val sub = when (kind) {
            "live" -> listOf(item.optString("liveTitle"), "mulai " + timeAgo(item.optString("date"))).filter { it.isNotBlank() && it != "mulai " }.joinToString(" · ")
            else -> fmtWib(item.optString("date"), "EEEE, d MMMM yyyy · HH.mm 'WIB'")
        }
        if (sub.isNotEmpty()) {
            VGap(4.dp)
            Txt(sub, AppText.mono(12.sp, c.inkSoft))
        }
    }
}

/** Pilihan bagian rekaman (replay yang terdiri dari beberapa file). */
@Composable
private fun PartPicker(count: Int, selected: Int, onSelect: (Int) -> Unit) {
    Column {
        VGap(16.dp)
        Micro("Bagian rekaman")
        VGap(8.dp)
        LiquidTabs(
            items = (1..count).map { TabItem("Bagian $it") },
            selectedIndex = selected,
            onSelected = onSelect,
            height = 48.dp,
            segmented = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/**
 * Halaman theater (siaran st.avonera48): info, pilihan bagian, lineup show, lalu obrolan penonton realtime.
 * Obrolan memakai long-poll yang langsung bangun saat ada pesan baru di ruang ini, jadi pesan dari siapa pun
 * tampil seketika di semua penonton. Pesan sendiri langsung ditambahkan dari balasan server (tanpa menunggu poll).
 */
@Composable
private fun Chat(room: String, title: String, label: String, lineup: List<JSONObject>, parts: Int, part: Int, onPart: (Int) -> Unit, modifier: Modifier, bottom: Dp) {
    val c = LocalColors.current
    val nav = LocalNav.current
    var rows by remember(room) { mutableStateOf<List<JSONObject>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var connected by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val state = rememberLazyListState()
    fun merge(batch: List<JSONObject>) {
        rows = (rows + batch).distinctBy { r -> r.optLong("id") }.sortedBy { r -> r.optLong("id") }.takeLast(200)
    }
    LaunchedEffect(room) {
        var after = 0L
        while (true) {
            runCatching { StreamApi.request("/chat/${Uri.encode(room)}?after=$after&wait=20") }
                .onSuccess {
                    val batch = it.optJSONArray("items")?.rows().orEmpty()
                    merge(batch)
                    batch.lastOrNull()?.let { row -> after = maxOf(after, row.optLong("id")) }
                    error = ""
                    connected = true
                }
                .onFailure {
                    connected = false
                    error = it.message.orEmpty()
                    delay(3_000)
                }
        }
    }
    LaunchedEffect(rows.size) { if (rows.isNotEmpty()) state.animateScrollToItem((state.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)) }
    fun send() {
        val message = text.trim()
        if (message.isEmpty() || sending) return
        sending = true
        scope.launch {
            runCatching { StreamApi.request("/chat/${Uri.encode(room)}", "POST", JSONObject().put("message", message)) }
                .onSuccess { res ->
                    text = ""
                    res.optJSONObject("item")?.let { merge(listOf(it)) }
                }
                .onFailure { error = it.message.orEmpty() }
            sending = false
        }
    }
    Column(modifier) {
        LazyColumn(Modifier.weight(1f), state = state, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { NowPlaying(JSONObject().put("kind", "theater").put("title", title).put("isLive", true), label) }
            if (parts > 1) item { PartPicker(parts, part, onPart) }
            if (lineup.isNotEmpty()) item {
                Column(Modifier.padding(top = 18.dp)) {
                    Micro("Lineup · ${lineup.size} member", color = c.brand)
                    VGap(10.dp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(lineup) { i, m ->
                            Column(
                                Modifier.width(62.dp).pressable({ nav.gallery(lineup.map { it.optString("img") }, i, title, "Lineup · ${m.optString("name")}") }),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Box(Modifier.size(58.dp).background(c.brandGradient, CircleShape).padding(2.5.dp)) {
                                    Picture(m.optString("img"), Modifier.fillMaxSize().clip(CircleShape), alignment = Alignment.TopCenter, fallback = m.optString("name"))
                                }
                                VGap(5.dp)
                                Txt(m.optString("name").substringBefore(' '), AppText.body(11.5.sp, c.ink, 700), maxLines = 1)
                            }
                        }
                    }
                }
            }
            item {
                Row(Modifier.padding(top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Image(StreamIcons.Chat, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
                    Gap(8.dp)
                    Micro("Obrolan penonton · ${rows.size}", Modifier.weight(1f), c.brand)
                    Box(Modifier.size(7.dp).background(if (connected) Color(0xFF2FA35A) else c.inkSoft, CircleShape))
                    Gap(6.dp)
                    Micro(if (connected) "Realtime" else "Menyambung", size = 9.5f)
                }
            }
            if (rows.isEmpty()) item { Txt("Belum ada pesan. Sapa penonton lain!", AppText.body(14.sp, c.inkSoft), Modifier.padding(vertical = 8.dp)) }
            items(rows, key = { it.optLong("id") }) { m -> ChatBubble(m) }
        }
        if (error.isNotEmpty()) Txt(error, AppText.body(12.sp, c.brand), Modifier.padding(horizontal = 18.dp))
        Row(
            Modifier.imePadding().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = bottom + 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.weight(1f).glassCard(26.dp).padding(horizontal = 16.dp, vertical = 14.dp)) {
                if (text.isEmpty()) Txt("Tulis pesan…", AppText.body(15.sp, c.inkSoft.copy(alpha = 0.7f)), maxLines = 1)
                androidx.compose.foundation.text.BasicTextField(
                    value = text,
                    onValueChange = { text = it.take(500) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    textStyle = AppText.body(15.sp, c.ink, 600),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(c.brand),
                )
            }
            LiquidIconButton(StreamIcons.Send, { send() }, size = 50.dp, iconSize = 20.dp, tint = c.brand, contentDescription = "Kirim")
        }
    }
}

/** Satu pesan obrolan: milik sendiri = gelembung merah di kanan, orang lain = kartu kaca di kiri. Dengan jam kirim (WIB). */
@Composable
private fun ChatBubble(m: JSONObject) {
    val c = LocalColors.current
    val mine = m.optBoolean("mine")
    val time = m.optLong("created").takeIf { it > 0 }?.let { fmtWib(java.time.Instant.ofEpochSecond(it).toString(), "HH.mm") }.orEmpty()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier
                .widthIn(max = 300.dp)
                .then(if (mine) Modifier.clip(RoundedCornerShape(20.dp, 20.dp, 6.dp, 20.dp)).background(c.brandGradient) else Modifier.glassCard(20.dp))
                .padding(horizontal = 14.dp, vertical = 9.dp),
            horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Txt(if (mine) "Kamu" else m.optString("name"), AppText.body(12.sp, if (mine) Color.White.copy(alpha = 0.85f) else c.brand, 800), maxLines = 1)
                if (time.isNotEmpty()) {
                    Gap(6.dp)
                    Txt(time, AppText.mono(10.sp, if (mine) Color.White.copy(alpha = 0.7f) else c.inkSoft))
                }
            }
            VGap(2.dp)
            Txt(m.optString("message"), AppText.body(14.5.sp, if (mine) Color.White else c.ink))
        }
    }
}

/** Buka tautan di aplikasi/peramban lain. */
@Composable
fun rememberOpenUrl(): (String) -> Unit {
    val context = LocalContext.current
    return { url -> if (url.startsWith("https://")) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
}
