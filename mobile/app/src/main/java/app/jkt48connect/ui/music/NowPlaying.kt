package app.jkt48connect.ui.music

import android.content.Context
import android.media.AudioManager
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
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
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.FastRewind
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Lyrics
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.LongState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import app.jkt48connect.core.Music
import app.jkt48connect.core.MusicTrack
import app.jkt48connect.ui.components.glassRim
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.theme.AppText
import androidx.compose.runtime.CompositionLocalProvider
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private const val MODE_COVER = 0
private const val MODE_LYRICS = 1
private const val MODE_QUEUE = 2

/** Isian kaca terang di atas latar gelap cover: tipis, tanpa outline (hanya kilau atas-bawah). */
private val GlassWhite = Color.White.copy(alpha = 0.12f)

/** Layar "Sedang diputar" penuh: muncul dari bawah, geser ke bawah untuk menutup. */
@Composable
fun NowPlayingHost() {
    AnimatedVisibility(
        visible = Music.nowPlayingOpen && Music.current != null,
        enter = slideInVertically(spring(dampingRatio = 0.86f, stiffness = 380f)) { it } + fadeIn(tween(180)),
        exit = slideOutVertically(spring(dampingRatio = 0.95f, stiffness = 420f)) { it } + fadeOut(tween(220)),
    ) {
        BackHandler { Music.nowPlayingOpen = false }
        NowPlaying { Music.nowPlayingOpen = false }
    }
}

@Composable
private fun NowPlaying(onClose: () -> Unit) {
    val track = Music.current ?: return
    var mode by rememberSaveable { mutableIntStateOf(MODE_COVER) }
    val clock = remember { mutableLongStateOf(Music.position()) }
    LaunchedEffect(Unit) { while (true) withFrameMillis { clock.longValue = Music.position() } }
    val drag = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val status = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val bg = rememberLayerBackdrop()
    val dismiss = Modifier.pointerInput(Unit) {
        detectVerticalDragGestures(
            onDragEnd = {
                scope.launch {
                    if (drag.value > with(density) { 150.dp.toPx() }) onClose() else drag.animateTo(0f, spring(0.8f, 500f))
                }
            },
        ) { change, amount ->
            change.consume()
            scope.launch { drag.snapTo((drag.value + amount).coerceAtLeast(0f)) }
        }
    }

    Box(Modifier.fillMaxSize().graphicsLayer { translationY = drag.value; val r = 1f - (drag.value / 4000f).coerceIn(0f, 0.08f); scaleX = r; scaleY = r }) {
        LivingArtwork(track, Modifier.fillMaxSize().clip(RoundedCornerShape(if (drag.value > 1f) 28.dp else 0.dp)).layerBackdrop(bg))
        CompositionLocalProvider(LocalBackdrop provides bg) {
            Column(Modifier.fillMaxSize().padding(top = status, bottom = navBar + 12.dp)) {
                Header(mode, onClose, dismiss)
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val big = minOf(maxWidth - 56.dp, maxHeight - 120.dp)
                    val small = 58.dp
                    val lyricsMode = mode != MODE_COVER
                    val playing = Music.playing
                    // Cover "bernapas" seperti iPhone: penuh saat diputar, mengecil saat dijeda.
                    val coverSize by animateDpAsState(if (lyricsMode) small else if (playing) big else big * 0.84f, spring(dampingRatio = 0.72f, stiffness = 220f), label = "cover")
                    val coverX by animateDpAsState(if (lyricsMode) 24.dp else (maxWidth - coverSize) / 2, spring(dampingRatio = 0.8f, stiffness = 260f), label = "coverX")
                    val coverY by animateDpAsState(if (lyricsMode) 6.dp else ((maxHeight - 96.dp - coverSize) / 2).coerceAtLeast(8.dp), spring(dampingRatio = 0.8f, stiffness = 260f), label = "coverY")
                    val radius by animateDpAsState(if (lyricsMode) 12.dp else 22.dp, tween(300), label = "radius")
                    val shadow by animateFloatAsState(if (lyricsMode || !playing) 0.25f else 0.6f, tween(400), label = "shadow")

                    // Lirik / antrean (di bawah kepala kecil).
                    AnimatedContent(
                        targetState = mode,
                        transitionSpec = { (fadeIn(tween(320, 120)) + scaleIn(tween(320, 120), 0.97f)) togetherWith fadeOut(tween(160)) },
                        modifier = Modifier.fillMaxSize().padding(top = if (lyricsMode) small + 18.dp else 0.dp),
                        label = "mode",
                    ) { m ->
                        when (m) {
                            MODE_LYRICS -> SyncedLyrics(Music.lyrics, Music.lyricsLoading, clock, onSeek = { Music.seekTo(it) }, modifier = Modifier.fillMaxSize())
                            MODE_QUEUE -> QueueList(Modifier.fillMaxSize())
                            else -> Box(Modifier.fillMaxSize())
                        }
                    }
                    // Judul & artis: di bawah cover (mode cover) atau di samping cover kecil (mode lirik).
                    val titleY by animateDpAsState(if (lyricsMode) 10.dp else coverY + coverSize + 26.dp, spring(dampingRatio = 0.82f, stiffness = 260f), label = "titleY")
                    val titleX by animateDpAsState(if (lyricsMode) 24.dp + small + 14.dp else 28.dp, spring(dampingRatio = 0.82f, stiffness = 260f), label = "titleX")
                    TitleBlock(track, lyricsMode, Modifier.offset { IntOffset(titleX.roundToPx(), titleY.roundToPx()) }.width(maxWidth - titleX - 24.dp))
                    MusicCover(
                        track,
                        Modifier
                            .offset { IntOffset(coverX.roundToPx(), coverY.roundToPx()) }
                            .size(coverSize)
                            .graphicsLayer { shadowElevation = 40f * shadow * density.density; shape = RoundedCornerShape(radius); clip = true }
                            .pressable({ mode = if (mode == MODE_COVER) MODE_LYRICS else MODE_COVER }, 0.98f),
                        radius,
                    )
                }
                Controls(clock, mode, onMode = { mode = if (mode == it) MODE_COVER else it })
            }
        }
    }
}

@Composable
private fun Header(mode: Int, onClose: () -> Unit, dismiss: Modifier) {
    Column(dismiss.fillMaxWidth()) {
        Box(Modifier.align(Alignment.CenterHorizontally).padding(top = 8.dp).size(38.dp, 5.dp).background(Color.White.copy(alpha = 0.45f), Capsule()))
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            LiquidIconButton(Icons.Rounded.KeyboardArrowDown, onClose, size = 42.dp, iconSize = 26.dp, iconColor = Color.White, fill = GlassWhite, contentDescription = "Tutup")
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                BasicText(when (mode) { MODE_LYRICS -> "LIRIK"; MODE_QUEUE -> "ANTREAN"; else -> "SEDANG DIPUTAR" }, style = AppText.micro(Color.White.copy(alpha = 0.65f)))
                BasicText("JKT48Connect Musik", style = AppText.body(13.sp, Color.White, 700))
            }
            Spacer(Modifier.size(42.dp))
        }
    }
}

@Composable
private fun TitleBlock(track: MusicTrack, compact: Boolean, modifier: Modifier) {
    val size by animateFloatAsState(if (compact) 17f else 24f, spring(dampingRatio = 0.85f, stiffness = 300f), label = "titleSize")
    Column(modifier) {
        BasicText(track.title, style = AppText.title(size.sp, Color.White), maxLines = 1, modifier = Modifier.basicMarquee(iterations = Int.MAX_VALUE, initialDelayMillis = 2500))
        BasicText(track.artist.ifEmpty { "JKT48" }, style = AppText.body((size * 0.68f).sp, Color.White.copy(alpha = 0.66f), 600), maxLines = 1)
    }
}

@Composable
private fun Controls(clock: LongState, mode: Int, onMode: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
        Scrubber(clock, Music.durationMs, onSeek = { Music.seekTo(it) })
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            SmallToggle(Icons.Rounded.Shuffle, Music.shuffle, "Acak") { Music.toggleShuffle() }
            LiquidIconButton(Icons.Rounded.FastRewind, { Music.previous() }, size = 60.dp, iconSize = 32.dp, iconColor = Color.White, fill = GlassWhite, contentDescription = "Sebelumnya")
            PlayPause(Music.playing, Music.buffering) { Music.toggle() }
            LiquidIconButton(Icons.Rounded.FastForward, { Music.next() }, size = 60.dp, iconSize = 32.dp, iconColor = Color.White, fill = GlassWhite, contentDescription = "Berikutnya")
            SmallToggle(if (Music.repeat == Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat, Music.repeat != Player.REPEAT_MODE_OFF, "Ulangi") { Music.cycleRepeat() }
        }
        AnimatedVisibility(mode == MODE_COVER, enter = fadeIn() + androidx.compose.animation.expandVertically(), exit = fadeOut() + androidx.compose.animation.shrinkVertically()) {
            VolumePill(Modifier.padding(top = 16.dp))
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            ModeButton(Icons.Rounded.Lyrics, "Lirik", mode == MODE_LYRICS) { onMode(MODE_LYRICS) }
            ModeButton(Icons.AutoMirrored.Rounded.QueueMusic, "Antrean", mode == MODE_QUEUE) { onMode(MODE_QUEUE) }
        }
    }
}

/** Tombol putar besar: ikon berganti dengan morph (skala + putar + pudar), membal saat ditekan. */
@Composable
private fun PlayPause(playing: Boolean, buffering: Boolean, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.Center) {
        LiquidIconButton(Icons.Rounded.PlayArrow, onClick, size = 78.dp, iconSize = 0.dp, iconColor = Color.Transparent, fill = Color.White.copy(alpha = 0.2f), contentDescription = if (playing) "Jeda" else "Putar")
        AnimatedContent(
            targetState = playing,
            transitionSpec = {
                (scaleIn(spring(dampingRatio = 0.55f, stiffness = 420f), 0.4f) + fadeIn(tween(120))) togetherWith (scaleOut(tween(140), 0.4f) + fadeOut(tween(100)))
            },
            label = "playPause",
        ) { p ->
            Image(if (p) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, Modifier.size(42.dp), colorFilter = ColorFilter.tint(Color.White))
        }
        if (buffering) {
            val spin by rememberInfiniteTransition(label = "buf").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "spin")
            Box(Modifier.size(86.dp).graphicsLayer { rotationZ = spin }.drawArcRing())
        }
    }
}

private fun Modifier.drawArcRing(): Modifier = this.then(
    Modifier.drawBehind {
        drawArc(Color.White.copy(alpha = 0.8f), 0f, 80f, false, style = androidx.compose.ui.graphics.drawscope.Stroke(2.5.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round))
    },
)

@Composable
private fun SmallToggle(icon: ImageVector, on: Boolean, label: String, onClick: () -> Unit) {
    val tint by animateColorAsState(if (on) Color.White else Color.White.copy(alpha = 0.5f), label = "toggle")
    Box(Modifier.size(40.dp).pressable(onClick, 0.85f), contentAlignment = Alignment.Center) {
        Image(icon, label, Modifier.size(22.dp), colorFilter = ColorFilter.tint(tint))
        if (on) Box(Modifier.align(Alignment.BottomCenter).size(4.dp).background(Color.White, Capsule()))
    }
}

@Composable
private fun ModeButton(icon: ImageVector, label: String, on: Boolean, onClick: () -> Unit) {
    val backdrop = LocalBackdrop.current
    val fill by animateColorAsState(if (on) Color.White.copy(alpha = 0.32f) else Color.White.copy(alpha = 0.08f), label = "modeFill")
    Row(
        Modifier
            .height(40.dp)
            .glass(backdrop, Capsule(), fill, blur = 6.dp, lensHeight = 10.dp, lensAmount = 18.dp, shadow = false)
            .pressable(onClick, 0.94f)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Image(icon, null, Modifier.size(19.dp), colorFilter = ColorFilter.tint(Color.White))
        BasicText(label, style = AppText.body(13.sp, Color.White, 700))
    }
}

/**
 * Scrubber kapsul kaca (gaya slider iOS 26/27): menebal saat disentuh, bagian terputar berupa kaca terang
 * dengan kilau atas-bawah, waktu berjalan & sisa waktu di bawahnya.
 */
@Composable
private fun Scrubber(clock: LongState, durationMs: Long, onSeek: (Long) -> Unit) {
    val backdrop = LocalBackdrop.current
    var dragging by remember { mutableStateOf(false) }
    var dragFraction by remember { mutableFloatStateOf(0f) }
    val fraction = if (dragging) dragFraction else if (durationMs > 0) (clock.longValue.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
    val h by animateDpAsState(if (dragging) 16.dp else 8.dp, spring(dampingRatio = 0.6f, stiffness = 500f), label = "scrubH")
    Column {
        Box(
            Modifier
                .fillMaxWidth()
                .height(28.dp)
                .pointerInput(durationMs) {
                    detectTapGestures { o -> if (durationMs > 0) onSeek((o.x / size.width * durationMs).toLong()) }
                }
                .pointerInput(durationMs) {
                    detectHorizontalDragGestures(
                        onDragStart = { o -> dragging = true; dragFraction = (o.x / size.width).coerceIn(0f, 1f) },
                        onDragEnd = { if (durationMs > 0) onSeek((dragFraction * durationMs).toLong()); dragging = false },
                        onDragCancel = { dragging = false },
                    ) { change, _ ->
                        change.consume()
                        dragFraction = (change.position.x / size.width).coerceIn(0f, 1f)
                    }
                },
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(Modifier.fillMaxWidth().height(h).glass(backdrop, Capsule(), Color.White.copy(alpha = 0.14f), blur = 8.dp, lensHeight = 6.dp, lensAmount = 10.dp, shadow = false)) {
                Box(
                    Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(fraction.coerceAtLeast(0.02f))
                        .clip(Capsule())
                        .background(Color.White.copy(alpha = if (dragging) 0.95f else 0.78f))
                        .glassRim(Capsule(), dark = false, strength = 0.6f),
                )
            }
        }
        Row(Modifier.fillMaxWidth()) {
            val shown = (fraction * durationMs).toLong()
            BasicText(fmtClock(shown), style = AppText.mono(11.sp, Color.White.copy(alpha = 0.65f)))
            Spacer(Modifier.weight(1f))
            BasicText("-" + fmtClock((durationMs - shown).coerceAtLeast(0)), style = AppText.mono(11.sp, Color.White.copy(alpha = 0.65f)))
        }
    }
}

/** Volume media (STREAM_MUSIC) sebagai kapsul kaca dengan ikon speaker & angka, seret untuk mengatur. */
@Composable
private fun VolumePill(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val backdrop = LocalBackdrop.current
    val audio = remember { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val max = remember { audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }
    var level by remember { mutableFloatStateOf(audio.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max) }
    var dragging by remember { mutableStateOf(false) }
    // Tombol volume fisik juga mengubah angka di sini.
    LaunchedEffect(Unit) {
        while (true) {
            delay(400)
            if (!dragging) level = audio.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max
        }
    }
    val shown by animateFloatAsState(level, spring(dampingRatio = 0.8f, stiffness = 600f), label = "vol")
    fun set(f: Float) {
        level = f.coerceIn(0f, 1f)
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, (level * max).roundToInt(), 0)
    }
    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .glass(backdrop, Capsule(), Color.White.copy(alpha = 0.1f), blur = 10.dp, lensHeight = 12.dp, lensAmount = 24.dp, shadow = false)
            .pointerInput(Unit) {
                detectHorizontalDragGestures(onDragStart = { dragging = true }, onDragEnd = { dragging = false }, onDragCancel = { dragging = false }) { change, amount ->
                    change.consume()
                    set(level + amount / size.width)
                }
            }
            .pointerInput(Unit) { detectTapGestures { o -> set(o.x / size.width) } }
            .padding(4.dp),
    ) {
        val minW = 96.dp
        val w = minW + (maxWidth - minW) * shown
        Row(
            Modifier
                .width(w)
                .fillMaxHeight()
                .clip(Capsule())
                .background(Color.White.copy(alpha = 0.16f))
                .glassRim(Capsule(), dark = true, strength = 1.6f)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(if (level <= 0.001f) Icons.AutoMirrored.Rounded.VolumeOff else Icons.AutoMirrored.Rounded.VolumeUp, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White))
            Spacer(Modifier.width(8.dp))
            BasicText("${(level * 100).roundToInt()}", style = AppText.mono(15.sp, Color.White, androidx.compose.ui.text.font.FontWeight.SemiBold))
        }
    }
}

@Composable
private fun QueueList(modifier: Modifier) {
    val q = Music.queue
    LazyColumn(modifier.padding(horizontal = 16.dp)) {
        itemsIndexed(q, key = { i, t -> "$i-${t.id}" }) { i, t ->
            val now = i == Music.index
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (now) Color.White.copy(alpha = 0.16f) else Color.Transparent)
                    .pressable({ Music.playAt(i) })
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MusicCover(t, Modifier.size(48.dp), 10.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    BasicText(t.title, style = AppText.body(15.sp, Color.White, 700), maxLines = 1)
                    BasicText(t.artist.ifEmpty { "JKT48" }, style = AppText.body(12.5.sp, Color.White.copy(alpha = 0.6f)), maxLines = 1)
                }
                if (now) EqualizerBars(Music.playing, Color.White)
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

/**
 * Latar hidup: cover diperbesar, diburamkan kuat, berputar & bergeser sangat pelan (dua lapis berlawanan arah)
 * di atas gradasi warna dominan cover. Di bawah Android 12 (tanpa blur) cukup gradasinya saja.
 */
@Composable
private fun LivingArtwork(track: MusicTrack, modifier: Modifier) {
    val colors = rememberCoverColors(track)
    val top by animateColorAsState(colors?.first ?: Color(0xFF6E1020), tween(900), label = "bgTop")
    val bottom by animateColorAsState(colors?.second ?: Color(0xFF1A0A0E), tween(900), label = "bgBottom")
    val bitmap = rememberCover(track, 320)
    val image = remember(bitmap) { bitmap?.asImageBitmap() }
    val inf = rememberInfiniteTransition(label = "living")
    val rot by inf.animateFloat(0f, 360f, infiniteRepeatable(tween(90_000, easing = LinearEasing)), label = "rot")
    val drift by inf.animateFloat(-1f, 1f, infiniteRepeatable(tween(16_000), RepeatMode.Reverse), label = "drift")
    Box(modifier.background(Brush.verticalGradient(listOf(top, bottom)))) {
        if (image != null && Build.VERSION.SDK_INT >= 31) {
            Image(
                image, null,
                Modifier.fillMaxSize().graphicsLayer { scaleX = 2.2f; scaleY = 2.2f; rotationZ = rot; translationX = drift * 40.dp.toPx(); alpha = 0.85f }.blur(80.dp, BlurredEdgeTreatment.Unbounded),
                contentScale = ContentScale.Crop,
            )
            Image(
                image, null,
                Modifier.fillMaxSize().graphicsLayer { scaleX = 1.8f; scaleY = 1.8f; rotationZ = -rot * 0.7f + 90f; translationY = drift * 60.dp.toPx(); alpha = 0.45f }.blur(90.dp, BlurredEdgeTreatment.Unbounded),
                contentScale = ContentScale.Crop,
            )
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.1f), Color.Black.copy(alpha = 0.22f), Color.Black.copy(alpha = 0.5f)))))
    }
}
