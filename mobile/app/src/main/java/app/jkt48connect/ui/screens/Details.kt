package app.jkt48connect.ui.screens

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.util.lerp
import app.jkt48connect.core.Images
import app.jkt48connect.ui.glass.glass
import com.kyant.shapes.Capsule
import kotlinx.coroutines.launch
import kotlin.math.abs
import android.view.TextureView
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Redeem
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import app.jkt48connect.core.Api
import app.jkt48connect.core.RecentDetail
import app.jkt48connect.core.RecentLive
import app.jkt48connect.core.Recording
import app.jkt48connect.core.NewsItem
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.fmtDuration
import app.jkt48connect.core.fmtNum
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.NewsBlock
import app.jkt48connect.core.htmlBlocks
import app.jkt48connect.core.parseInstant
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.CategoryPill
import app.jkt48connect.ui.components.CountUp
import app.jkt48connect.ui.components.AutoImage
import app.jkt48connect.ui.components.Countdown
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.RecentTile
import app.jkt48connect.ui.components.ShowTile
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.StatBox
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LiquidSlider
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.delay

private val Pad = 16.dp

@Composable
private fun detailPadding() = PaddingValues(start = Pad, end = Pad, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)

/** Detail rekap: foto, statistik, replay (terkunci 72 jam), supporter, gift, dan cuplikan layar. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecentDetailScreen(r: RecentLive) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val detail = rememberLoad(r.id) { Api.recentDetail(r.id, it) }
    val d = detail.data
    LazyColumn(contentPadding = detailPadding()) {
        item {
            Row(Modifier.staggerIn(0), verticalAlignment = Alignment.CenterVertically) {
                NetImage(r.img, Modifier.size(84.dp, 100.dp).clip(RoundedCornerShape(20.dp)), fallback = r.name)
                Spacer(Modifier.width(16.dp))
                Column {
                    Micro(r.platformLabel, color = c.brand, dot = true)
                    VGap(6.dp)
                    Txt(r.name.uppercase(), AppText.display(32.sp, c.ink))
                    VGap(4.dp)
                    Txt("${fmtDate(r.start, "EEEE, d MMM yyyy")} · ${fmtTime(r.start)}", AppText.mono(11.5.sp, c.inkSoft))
                }
            }
            VGap(16.dp)
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox("Durasi", Modifier.weight(1f).height(78.dp).staggerIn(1), accent = true) { Txt(fmtDuration(r.durationMs), AppText.display(30.sp, Color.White)) }
                    StatBox("Penonton", Modifier.weight(1f).height(78.dp).staggerIn(2)) { CountUp(r.viewers, AppText.display(30.sp, c.ink)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox(r.pointLabel, Modifier.weight(1f).height(78.dp).staggerIn(3)) { CountUp(r.points, AppText.display(30.sp, c.ink)) }
                    StatBox("Komentar", Modifier.weight(1f).height(78.dp).staggerIn(4)) { CountUp(d?.comments, AppText.display(30.sp, c.ink)) }
                }
            }
            VGap(18.dp)
        }
        when {
            detail.error != null && d == null -> item { ErrorRetry(detail.error!!, { detail.run(true) }) }
            d == null -> item { Skeleton(Modifier.fillMaxWidth().height(220.dp), 26.dp) }
            else -> {
                item { ReplayPanel(d, onUnlock = { detail.run(true) }) }
                if (d.fans.isNotEmpty()) item {
                    VGap(26.dp)
                    Micro("Top supporter", color = c.brand, dot = true)
                    VGap(10.dp)
                    Column(Modifier.fillMaxWidth().appCard(24.dp).padding(horizontal = 12.dp, vertical = 6.dp)) {
                        d.fans.take(10).forEachIndexed { i, f ->
                            if (i > 0) Box(Modifier.fillMaxWidth().height(0.8.dp).background(c.line))
                            Row(Modifier.padding(vertical = 8.dp).staggerIn(i, 30), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    Modifier.size(26.dp).clip(CircleShape).then(if (i < 3) Modifier.background(c.brandGradient) else Modifier),
                                    contentAlignment = Alignment.Center,
                                ) { Txt("${i + 1}", AppText.mono(11.5.sp, if (i < 3) Color.White else c.inkSoft, FontWeight.SemiBold)) }
                                Spacer(Modifier.width(10.dp))
                                NetImage(f.avatar, Modifier.size(34.dp).clip(CircleShape), fallback = f.name)
                                Spacer(Modifier.width(10.dp))
                                Txt(f.name, AppText.body(14.sp, c.ink, 700), Modifier.weight(1f), maxLines = 1)
                                Txt(fmtNum(f.amount), AppText.mono(12.5.sp, if (i < 3) c.brand else c.ink, FontWeight.SemiBold))
                            }
                        }
                    }
                }
                if (d.gifts.isNotEmpty()) item {
                    VGap(26.dp)
                    Micro("Gift", color = c.brand, dot = true)
                    VGap(10.dp)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        d.gifts.take(18).forEach { g ->
                            Row(Modifier.appCard(99.dp).padding(6.dp, 6.dp, 12.dp, 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                if (g.img.isEmpty()) Image(Icons.Rounded.Redeem, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.brand))
                                else NetImage(g.img, Modifier.size(26.dp), contentScale = ContentScale.Fit, alignment = Alignment.Center)
                                Spacer(Modifier.width(6.dp))
                                Txt("${g.name} ×${fmtNum(g.num)}", AppText.body(12.5.sp, c.ink, 700))
                            }
                        }
                    }
                }
                if (d.screenshots.isNotEmpty()) item {
                    VGap(26.dp)
                    Micro("Cuplikan · ${d.screenshots.size}", color = c.brand, dot = true)
                    VGap(10.dp)
                    val shots = d.screenshots
                    val shotTitle = "${d.name} · ${fmtDate(d.start, "d MMM yyyy")}"
                    // 9 petak; petak terakhir menunjukkan sisa cuplikan (+N), semuanya bisa digeser di penampil.
                    val visible = shots.take(9)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        visible.chunked(3).forEachIndexed { row, chunk ->
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                chunk.forEachIndexed { col, url ->
                                    val i = row * 3 + col
                                    val more = if (i == visible.lastIndex) shots.size - visible.size else 0
                                    Box(Modifier.weight(1f).aspectRatio(0.75f).clip(RoundedCornerShape(14.dp)).pressable({ nav.push(Route.Shots(shots, i, shotTitle)) }).staggerIn(i, 25)) {
                                        NetImage(url, Modifier.fillMaxSize(), alignment = Alignment.Center)
                                        if (more > 0) {
                                            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                                                Txt("+$more", AppText.display(30.sp, Color.White))
                                            }
                                        }
                                    }
                                }
                                repeat(3 - chunk.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Replay: terkunci dengan hitung mundur sampai 72 jam setelah live, lalu berubah jadi pemutar. */
@Composable
private fun ReplayPanel(d: RecentDetail, onUnlock: () -> Unit) {
    val c = LocalColors.current
    if (d.recordingCount == 0) return
    val panel = Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.panel).then(if (c.dark) Modifier.appCard(28.dp) else Modifier)
    if (d.recordings.isEmpty()) {
        val unlock = parseInstant(d.replayUnlockAt)?.toEpochMilli()
        val start = parseInstant(d.end.ifEmpty { d.start })?.toEpochMilli()
        val progress = if (unlock == null || start == null) 0f else ((System.currentTimeMillis() - start).toFloat() / (unlock - start)).coerceIn(0f, 1f)
        val bar = remember { Animatable(0f) }
        LaunchedEffect(progress) { bar.animateTo(progress, tween(1400)) }
        Column(panel.padding(20.dp).staggerIn(5)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(46.dp).background(c.brandGradient, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
                    Image(Icons.Rounded.Lock, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White))
                }
                Spacer(Modifier.width(14.dp))
                Txt("REPLAY · TERBUKA 72 JAM SETELAH LIVE", AppText.micro(Color.White.copy(alpha = 0.55f)), Modifier.weight(1f))
            }
            VGap(14.dp)
            if (unlock != null) Countdown(d.replayUnlockAt, AppText.display(34.sp, Color.White))
            if (unlock != null && System.currentTimeMillis() > unlock) {
                VGap(10.dp)
                Txt("Muat replay", AppText.body(14.sp, c.brand, 800), Modifier.pressable(onUnlock))
            }
            VGap(14.dp)
            Box(Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.12f))) {
                Box(Modifier.fillMaxWidth(bar.value).height(6.dp).background(c.brandGradient, CircleShape))
            }
            VGap(8.dp)
            Row {
                Txt("Live selesai", AppText.mono(10.5.sp, Color.White.copy(alpha = 0.38f)))
                Spacer(Modifier.weight(1f))
                Txt("${(progress * 100).toInt()}%", AppText.mono(10.5.sp, Color.White.copy(alpha = 0.7f)))
                Spacer(Modifier.weight(1f))
                Txt("Replay terbuka", AppText.mono(10.5.sp, Color.White.copy(alpha = 0.38f)))
            }
        }
        return
    }
    var part by remember { mutableIntStateOf(0) }
    val rec = d.recordings[part.coerceIn(0, d.recordings.lastIndex)]
    Column(panel.padding(10.dp)) {
        Row(Modifier.padding(8.dp, 4.dp, 8.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Image(Icons.Rounded.PlayArrow, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.brand))
            Spacer(Modifier.width(4.dp))
            Txt("REPLAY", AppText.micro(Color.White.copy(alpha = 0.6f)), Modifier.weight(1f))
            if (d.recordings.size > 1) d.recordings.indices.forEach { i ->
                Box(
                    Modifier.padding(start = 6.dp).clip(CircleShape)
                        .then(if (i == part) Modifier.background(c.brandGradient) else Modifier.background(Color.White.copy(alpha = 0.1f)))
                        .pressable({ part = i }).padding(horizontal = 10.dp, vertical = 5.dp)
                ) { Txt("Bagian ${i + 1}", AppText.body(11.sp, Color.White, 700)) }
            }
        }
        androidx.compose.runtime.key(rec.url) { ReplayPlayer(rec, portrait = d.platform == "idn") }
    }
}

/**
 * Pemutar replay (Media3): memakai playlist HLS dari worker (mulai & seek cepat), cadangan MP4.
 * Token aplikasi ikut di header. Kontrolnya kaca: tombol play bulat dan slider lensa yang membiaskan video.
 */
@OptIn(UnstableApi::class)
@Composable
private fun ReplayPlayer(rec: Recording, portrait: Boolean) {
    val context = LocalContext.current
    var player by remember { mutableStateOf<ExoPlayer?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var playing by remember { mutableStateOf(false) }
    var buffering by remember { mutableStateOf(true) }
    var ratio by remember { mutableFloatStateOf(if (portrait) 9f / 16f else 16f / 9f) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(rec.durationMs) }
    var dragging by remember { mutableStateOf<Float?>(null) }
    var controls by remember { mutableStateOf(true) }
    var lastTouch by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(rec.url) {
        val headers = runCatching { Api.authHeaders() }.getOrElse { emptyMap() }
        val source = DefaultHttpDataSource.Factory().setDefaultRequestProperties(headers).setAllowCrossProtocolRedirects(true)
        val exo = ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(source)).build()
        var usingHls = rec.hls != null
        fun load() {
            val item = MediaItem.Builder().setUri(Api.absolute(if (usingHls) rec.hls!! else rec.url))
            if (usingHls) item.setMimeType(MimeTypes.APPLICATION_M3U8)
            exo.setMediaItem(item.build())
            exo.prepare()
        }
        exo.addListener(object : Player.Listener {
            override fun onPlayerError(e: PlaybackException) {
                if (usingHls) {
                    usingHls = false // HLS gagal → MP4 biasa
                    load()
                } else {
                    error = e.localizedMessage ?: "Replay belum bisa diputar"
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }

            override fun onPlaybackStateChanged(state: Int) {
                buffering = state == Player.STATE_BUFFERING
                if (exo.duration > 0) duration = exo.duration
            }

            override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
                if (size.width > 0 && size.height > 0) ratio = size.width * size.pixelWidthHeightRatio / size.height
            }
        })
        load()
        player = exo
        while (true) {
            if (dragging == null) position = exo.currentPosition
            if (exo.isPlaying && System.currentTimeMillis() - lastTouch > 3000) controls = false
            delay(250)
        }
    }
    DisposableEffect(Unit) { onDispose { player?.release() } }

    val maxH = LocalConfiguration.current.screenHeightDp.dp * 0.62f
    val videoBackdrop = rememberLayerBackdrop()
    fun wake() {
        controls = true
        lastTouch = System.currentTimeMillis()
    }
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(max = maxH)
            .aspectRatio(ratio, matchHeightConstraintsFirst = ratio < 1f)
            .clip(RoundedCornerShape(20.dp))
            .background(Color.Black)
            .pointerInput(player) {
                detectTapGestures(
                    onTap = { wake() },
                    onDoubleTap = { off ->
                        player?.let { p -> p.seekTo((p.currentPosition + if (off.x < size.width / 2) -10_000 else 10_000).coerceAtLeast(0)) }
                        wake()
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.fillMaxSize().layerBackdrop(videoBackdrop)) {
            player?.let { p ->
                AndroidView(factory = { TextureView(it).also { v -> p.setVideoTextureView(v) } }, modifier = Modifier.fillMaxSize())
            }
        }
        if (error != null) {
            Txt("Replay belum bisa diputar.\n$error", AppText.body(13.sp, Color.White.copy(alpha = 0.7f)), Modifier.padding(20.dp))
        } else if (buffering) {
            Spinner()
        }
        AnimatedVisibility(controls || !playing, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.5f to Color.Transparent, 1f to Color(0xAA000000)))) {
                LiquidIconButton(
                    if (playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    {
                        player?.let { if (it.isPlaying) it.pause() else it.play() }
                        wake()
                    },
                    Modifier.align(Alignment.Center),
                    size = 74.dp,
                    iconSize = 38.dp,
                    iconColor = Color.White,
                    backdrop = videoBackdrop,
                    contentDescription = if (playing) "Jeda" else "Putar",
                )
                Row(Modifier.align(Alignment.BottomCenter).padding(12.dp, 0.dp, 12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Txt(time(dragging?.let { (it * duration).toLong() } ?: position), AppText.mono(11.sp, Color.White))
                    Spacer(Modifier.width(10.dp))
                    LiquidSlider(
                        value = { if (duration > 0) (position.toFloat() / duration).coerceIn(0f, 1f) else 0f },
                        onValueChange = { dragging = it; wake() },
                        onValueChangeFinished = { v ->
                            player?.seekTo((v * duration).toLong())
                            position = (v * duration).toLong()
                            dragging = null
                            wake()
                        },
                        modifier = Modifier.weight(1f),
                        backdrop = videoBackdrop,
                    )
                    Spacer(Modifier.width(10.dp))
                    Txt(time(duration), AppText.mono(11.sp, Color.White.copy(alpha = 0.7f)))
                }
            }
        }
    }
}

private fun time(ms: Long): String {
    val s = ms / 1000
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%02d:%02d".format(s / 60, s % 60)
}

/** Penampil cuplikan layar: geser kiri/kanan, cubit untuk zoom. */
@Composable
fun ShotViewer(urls: List<String>, start: Int, title: String) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val pager = rememberPagerState(start) { urls.size }
    val backdrop = rememberLayerBackdrop()
    val strip = rememberLazyListState((start - 2).coerceAtLeast(0))
    var chrome by remember { mutableStateOf(true) }
    var zoomed by remember { mutableStateOf(false) }
    // Geser vertikal (saat tidak di-zoom) untuk menutup: gambar ikut turun, latar memudar.
    val drag = remember { Animatable(0f) }
    val dismissPx = with(LocalDensity.current) { 140.dp.toPx() }
    val fade = (abs(drag.value) / (dismissPx * 2.5f)).coerceIn(0f, 1f)
    LaunchedEffect(pager.currentPage) { strip.animateScrollToItem((pager.currentPage - 2).coerceAtLeast(0)) }

    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 1f - fade))) {
        HorizontalPager(
            pager,
            Modifier
                .fillMaxSize()
                .layerBackdrop(backdrop)
                .pointerInput(zoomed) {
                    if (zoomed) return@pointerInput
                    detectVerticalDragGestures(
                        onDragEnd = { scope.launch { if (abs(drag.value) > dismissPx) nav.pop() else drag.animateTo(0f, spring(0.75f, 400f)) } },
                        onDragCancel = { scope.launch { drag.animateTo(0f, spring(0.75f, 400f)) } },
                    ) { change, amount ->
                        change.consume()
                        scope.launch { drag.snapTo(drag.value + amount) }
                    }
                }
                .graphicsLayer {
                    translationY = drag.value
                    val k = 1f - fade * 0.2f
                    scaleX = k
                    scaleY = k
                },
            pageSpacing = 16.dp,
            beyondViewportPageCount = 1,
            userScrollEnabled = !zoomed,
        ) { page ->
            ZoomImage(
                urls[page],
                resetKey = pager.settledPage,
                onZoomChange = { if (page == pager.currentPage) zoomed = it },
                onTap = { chrome = !chrome },
            )
        }

        AnimatedVisibility(chrome && drag.value == 0f, enter = fadeIn(tween(180)), exit = fadeOut(tween(180))) {
            Box(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxWidth().height(150.dp).background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.65f), Color.Transparent))))
                Row(Modifier.statusBarsPadding().padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    LiquidButton(
                        onClick = { nav.pop() },
                        modifier = Modifier.size(48.dp),
                        backdrop = backdrop,
                        fill = Color.White.copy(alpha = 0.14f),
                        contentPadding = PaddingValues(0.dp),
                    ) { Image(Icons.Rounded.Close, "Tutup", Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White)) }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Txt(title.ifEmpty { "Cuplikan" }, AppText.body(15.sp, Color.White, 800), maxLines = 1)
                        Txt("CUPLIKAN LAYAR LIVE", AppText.micro(Color.White.copy(alpha = 0.6f), 9.sp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.glass(backdrop, Capsule(), Color.White.copy(alpha = 0.14f), blur = 6.dp).padding(horizontal = 14.dp, vertical = 9.dp)) {
                        Txt("${pager.currentPage + 1} / ${urls.size}", AppText.mono(13.sp, Color.White, FontWeight.SemiBold))
                    }
                }
                Column(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
                        .navigationBarsPadding()
                        .padding(top = 36.dp, bottom = 14.dp),
                ) {
                    LazyRow(state = strip, contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        itemsIndexed(urls) { i, url ->
                            val selected = i == pager.currentPage
                            val k by animateFloatAsState(if (selected) 1f else 0.86f, spring(0.7f, 500f), label = "thumb")
                            NetImage(
                                url,
                                Modifier
                                    .size(54.dp, 72.dp)
                                    .graphicsLayer {
                                        scaleX = k
                                        scaleY = k
                                        alpha = if (selected) 1f else 0.55f
                                    }
                                    .clip(RoundedCornerShape(12.dp))
                                    .then(if (selected) Modifier.border(2.dp, Color.White, RoundedCornerShape(12.dp)) else Modifier)
                                    .pressable({ scope.launch { pager.animateScrollToPage(i) } }),
                                alignment = Alignment.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Satu halaman cuplikan: cubit untuk zoom, ketuk dua kali untuk zoom di titik itu, geser hanya saat di-zoom. */
@Composable
private fun ZoomImage(url: String, resetKey: Int, onZoomChange: (Boolean) -> Unit, onTap: () -> Unit) {
    val scope = rememberCoroutineScope()
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var size by remember { mutableStateOf(IntSize.Zero) }
    LaunchedEffect(resetKey) {
        scale = 1f
        offset = Offset.Zero
    }
    fun clamp(o: Offset, s: Float): Offset {
        val mx = size.width * (s - 1f) / 2f
        val my = size.height * (s - 1f) / 2f
        return Offset(o.x.coerceIn(-mx, mx), o.y.coerceIn(-my, my))
    }
    val state = rememberTransformableState { zoom, pan, _ ->
        val s = (scale * zoom).coerceIn(1f, 5f)
        offset = if (s == 1f) Offset.Zero else clamp(offset + pan, s)
        scale = s
        onZoomChange(s > 1f)
    }
    val bitmap by produceState<ImageBitmap?>(null, url, size.width) {
        if (size.width > 0) value = Images.load(url, (size.width * 1.5f).toInt().coerceAtMost(2048))?.asImageBitmap()
    }
    Box(
        Modifier
            .fillMaxSize()
            .onSizeChanged { size = it }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onDoubleTap = { p ->
                        scope.launch {
                            val target = if (scale > 1f) 1f else 2.5f
                            val to = if (target == 1f) Offset.Zero else clamp((Offset(size.width / 2f, size.height / 2f) - p) * (target - 1f), target)
                            val fromScale = scale
                            val fromOffset = offset
                            onZoomChange(target > 1f)
                            animate(0f, 1f, animationSpec = spring(0.85f, 400f)) { t, _ ->
                                scale = lerp(fromScale, target, t)
                                offset = androidx.compose.ui.geometry.lerp(fromOffset, to, t)
                            }
                        }
                    },
                )
            }
            .transformable(state, canPan = { scale > 1f }),
        contentAlignment = Alignment.Center,
    ) {
        val b = bitmap
        if (b == null) {
            Spinner()
        } else {
            Image(
                b,
                null,
                Modifier.fillMaxSize().graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
                contentScale = ContentScale.Fit,
            )
        }
    }
}

/** Profil member: foto besar di belakang panel info kaca (bisa ditarik), statistik, sosial, dan jadwal theater. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MemberDetailScreen(id: String, name: String, img: String) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val open = rememberOpenUrl()
    val data = rememberLoad(id) { Api.member(id, it) }
    val m = data.data
    val activity = rememberLoad("activity", id) { Api.memberActivity(id, it) }
    val h = LocalConfiguration.current.screenHeightDp.dp
    val photoBackdrop = rememberLayerBackdrop()
    LazyColumn(contentPadding = PaddingValues(bottom = 40.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(h * 0.62f)) {
                Box(Modifier.fillMaxSize().layerBackdrop(photoBackdrop)) {
                    NetImage(m?.img ?: img, Modifier.fillMaxSize(), fallback = name)
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.6f to c.bg.copy(alpha = 0f), 1f to c.bg)))
                }
                LiquidButton(
                    onClick = {},
                    modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp, 0.dp, 16.dp, 8.dp).fillMaxWidth().staggerIn(0),
                    backdrop = photoBackdrop,
                    shape = RoundedRectangle(28.dp),
                    blur = 6.dp,
                    lensHeight = 20.dp,
                    lensAmount = 36.dp,
                    contentPadding = PaddingValues(18.dp),
                    horizontalArrangement = Arrangement.Start,
                ) {
                    Column {
                        Micro(if (m == null) "JKT48" else if (m.isGraduate) "Lulus" else "Member aktif", color = c.brand, dot = true)
                        VGap(6.dp)
                        Txt((m?.shortName ?: name).uppercase(), AppText.display(42.sp, c.ink))
                        Txt(m?.fullname?.ifEmpty { null } ?: m?.name ?: name, AppText.body(14.sp, c.inkSoft))
                    }
                }
            }
        }
        when {
            data.error != null && m == null -> item { ErrorRetry(data.error!!, { data.run(true) }) }
            m == null -> item { Loading() }
            else -> {
                item {
                    Row(Modifier.padding(12.dp, 14.dp, 12.dp, 0.dp).staggerIn(1)) {
                        listOf(
                            "Lahir" to (if (m.birthdate.isEmpty()) "–" else fmtDate(m.birthdate, "d MMM yyyy")),
                            "Tinggi" to m.height.ifEmpty { "–" },
                            "Gol. darah" to m.bloodType.ifEmpty { "–" },
                        ).forEach { (label, value) ->
                            Column(Modifier.weight(1f).padding(horizontal = 4.dp).appCard(18.dp).padding(12.dp)) {
                                Txt(label.uppercase(), AppText.micro(c.inkSoft, 9.sp))
                                VGap(4.dp)
                                Txt(value, AppText.body(14.sp, c.ink, 800), maxLines = 1)
                            }
                        }
                    }
                }
                if (m.totalShowroom != null || m.totalIdn != null) item {
                    Row(Modifier.padding(16.dp, 10.dp, 16.dp, 0.dp).staggerIn(2), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        listOf("Live Showroom" to m.totalShowroom, "Live IDN" to m.totalIdn).forEach { (label, v) ->
                            Column(Modifier.weight(1f).clip(RoundedCornerShape(22.dp)).background(c.panel).then(if (c.dark) Modifier.appCard(22.dp) else Modifier).padding(16.dp)) {
                                Txt(label.uppercase(), AppText.micro(Color.White.copy(alpha = 0.55f), 9.5.sp))
                                VGap(6.dp)
                                CountUp(v, AppText.display(34.sp, Color.White))
                            }
                        }
                    }
                }
                if (m.jikosokai.isNotEmpty()) item {
                    Column(Modifier.padding(20.dp, 22.dp, 20.dp, 0.dp).staggerIn(3)) {
                        Micro("Jikoshoukai", color = c.brand, dot = true)
                        VGap(8.dp)
                        Txt("“${m.jikosokai}”", AppText.body(16.sp, c.ink, 600, 1.5f))
                    }
                }
                if (m.socials.isNotEmpty()) item {
                    FlowRow(Modifier.padding(16.dp, 20.dp, 16.dp, 0.dp).staggerIn(4), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        m.socials.forEach { so ->
                            LiquidButton(onClick = { open(so.url) }, modifier = Modifier.height(40.dp), contentPadding = PaddingValues(horizontal = 14.dp)) {
                                Txt(so.title, AppText.body(13.sp, c.ink, 700))
                                Image(Icons.Rounded.OpenInNew, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(c.brand))
                            }
                        }
                    }
                }
                val act = activity.data
                val upcoming = (m.upcomingShows + act?.upcoming.orEmpty()).distinctBy { it.id }.sortedBy { it.date }
                val past = (m.recentShows + act?.pastShows.orEmpty()).distinctBy { it.id }.sortedByDescending { it.date }.take(5)
                val lives = act?.lives.orEmpty().take(5)
                listOf(
                    "Theater mendatang" to upcoming,
                    "Theater terakhir" to past,
                ).forEach { (label, shows) ->
                    item { Micro(label, Modifier.padding(20.dp, 26.dp, 20.dp, 10.dp), color = c.brand, dot = true) }
                    when {
                        shows.isNotEmpty() -> shows.forEachIndexed { i, show ->
                            item { ShowTile(show, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.Theater(show.id, show.title)) } }
                        }
                        act == null && activity.error == null -> item { Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(96.dp), 24.dp) }
                        else -> item { EmptyNote(if (label == "Theater mendatang") "Belum ada jadwal theater." else "Tidak ada di arsip theater terbaru.") }
                    }
                }
                item { Micro("Live terakhir", Modifier.padding(20.dp, 26.dp, 20.dp, 10.dp), color = c.brand, dot = true) }
                when {
                    lives.isNotEmpty() -> lives.forEachIndexed { i, r ->
                        item { RecentTile(r, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.Recent(r)) } }
                    }
                    act == null && activity.error == null -> item { Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(94.dp), 24.dp) }
                    else -> item { EmptyNote("Tidak ada live di riwayat terbaru.") }
                }
            }
        }
    }
}

@Composable
private fun EmptyNote(text: String) {
    val c = LocalColors.current
    Txt(text, AppText.body(13.sp, c.inkSoft), Modifier.padding(horizontal = 20.dp).fillMaxWidth().appCard(18.dp).padding(16.dp))
}

/** Detail pertunjukan: banner, waktu, hitung mundur, member tampil, dan setlist. */
@Composable
fun TheaterDetailScreen(id: String) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val data = rememberLoad(id) { Api.theaterDetail(id, it) }
    val t = data.data
    LazyColumn(contentPadding = detailPadding()) {
        when {
            data.error != null && t == null -> item { ErrorRetry(data.error!!, { data.run(true) }) }
            t == null -> item { Loading() }
            else -> {
                val img = t.banner.ifEmpty { t.poster }
                if (img.isNotEmpty()) item { NetImage(img, Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(26.dp)).staggerIn(0), alignment = Alignment.Center) }
                item {
                    Column {
                        VGap(18.dp)
                        Row(Modifier.staggerIn(1), verticalAlignment = Alignment.CenterVertically) {
                            CategoryPill(t.category)
                            if (t.team.isNotEmpty()) {
                                Spacer(Modifier.width(8.dp))
                                Micro(t.team)
                            }
                        }
                        VGap(10.dp)
                        Txt(t.title.uppercase(), AppText.display(36.sp, c.ink), Modifier.staggerIn(2))
                        VGap(8.dp)
                        Txt("${fmtDate(t.date)} · ${fmtTime(t.date)}", AppText.mono(13.sp, c.inkSoft), Modifier.staggerIn(3))
                        if ((parseInstant(t.date)?.toEpochMilli() ?: 0) > System.currentTimeMillis()) {
                            VGap(14.dp)
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.brandGradient).padding(16.dp).staggerIn(4), verticalAlignment = Alignment.CenterVertically) {
                                Image(Icons.Rounded.Timer, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White))
                                Spacer(Modifier.width(10.dp))
                                Txt("Mulai dalam ", AppText.body(14.sp, Color.White.copy(alpha = 0.7f)))
                                Countdown(t.date, AppText.mono(15.sp, Color.White, FontWeight.SemiBold))
                            }
                        }
                    }
                }
                if (t.members.isNotEmpty()) item {
                    VGap(26.dp)
                    Micro("Member tampil · ${t.members.size}", color = c.brand, dot = true)
                    VGap(12.dp)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        t.members.chunked(4).forEachIndexed { row, chunk ->
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                chunk.forEachIndexed { col, m ->
                                    Column(Modifier.weight(1f).pressable({ nav.push(Route.Member(m.id, m.name, m.img)) }).staggerIn(row * 4 + col, 25), horizontalAlignment = Alignment.CenterHorizontally) {
                                        NetImage(m.img, Modifier.fillMaxWidth().aspectRatio(0.78f).clip(RoundedCornerShape(16.dp)), fallback = m.name)
                                        VGap(6.dp)
                                        Txt(m.name.substringBefore(' '), AppText.body(12.sp, c.ink, 700), maxLines = 1)
                                    }
                                }
                                repeat(4 - chunk.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
                if (t.songs.isNotEmpty()) item {
                    VGap(26.dp)
                    Micro("Setlist", color = c.brand, dot = true)
                    VGap(8.dp)
                    t.songs.forEachIndexed { i, song ->
                        Row(Modifier.padding(vertical = 7.dp)) {
                            Txt((i + 1).toString().padStart(2, '0'), AppText.mono(12.sp, c.brand, FontWeight.SemiBold), Modifier.width(34.dp))
                            Txt(song, AppText.body(15.sp, c.ink, 600))
                        }
                    }
                }
            }
        }
    }
}

/** Isi berita: HTML jkt48.com → teks biasa; tautan asli bisa dibuka lewat tombol kaca. */
@Composable
fun NewsDetailScreen(item: NewsItem) {
    val c = LocalColors.current
    val open = rememberOpenUrl()
    val data = rememberLoad(item.id) { Api.newsDetail(item.id, it) }
    LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)) {
        item {
            Column {
                Micro(item.category.ifEmpty { data.data?.category ?: "Berita" }, Modifier.staggerIn(0), color = c.brand, dot = true)
                VGap(10.dp)
                Txt(item.title, AppText.display(32.sp, c.ink), Modifier.staggerIn(1))
                VGap(10.dp)
                Txt(fmtDate(item.date, "EEEE, d MMMM yyyy"), AppText.mono(12.sp, c.inkSoft), Modifier.staggerIn(2))
                VGap(20.dp)
            }
        }
        val n = data.data
        when {
            data.error != null && n == null -> item { ErrorRetry(data.error!!, { data.run(true) }) }
            n == null -> items(5) { Skeleton(Modifier.padding(bottom = 10.dp).fillMaxWidth().height(16.dp), 6.dp) }
            else -> htmlBlocks(n.content).forEachIndexed { i, block ->
                item {
                    when (block) {
                        is NewsBlock.Text -> Txt(block.text, AppText.body(16.sp, c.ink, 500, 1.65f), Modifier.padding(bottom = 14.dp).staggerIn(3 + i))
                        is NewsBlock.Image -> AutoImage(block.url, Modifier.padding(bottom = 16.dp))
                    }
                }
            }
        }
        val url = item.url.ifEmpty { n?.url.orEmpty() }
        if (url.isNotEmpty()) item {
            VGap(24.dp)
            LiquidButton(onClick = { open(url) }, modifier = Modifier.height(50.dp)) {
                Txt("Buka di jkt48.com", AppText.body(14.sp, c.ink, 800))
                Image(Icons.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
            }
        }
    }
}
