package app.jkt48connect.ui.music

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Lyrics
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.LongState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.LyricLine
import app.jkt48connect.core.Lyrics
import app.jkt48connect.ui.theme.AppText
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

private val EaseOutQuint = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
private val Dim = Color.White.copy(alpha = 0.32f)

/** Batas waktu satu baris: sampai baris berikutnya, maksimal 8 detik (supaya jeda panjang jadi interlude). */
private fun ends(lines: List<LyricLine>) = lines.mapIndexed { i, l ->
    val next = lines.getOrNull(i + 1)?.time ?: (l.time + 6.0)
    min(next, l.time + 8.0)
}

/**
 * Lirik sinkron ala pemutar musik iPhone:
 * - baris aktif penuh terang & sedikit membesar (pegas memantul), kata-kata terisi satu per satu mengikuti waktu;
 * - baris lain mengecil, meredup, dan makin blur sesuai jaraknya, berubah bertahap seperti gelombang;
 * - daftar bergulir mengikuti lagu dengan pegas lembut; saat diseret pengguna, blur hilang dan auto-gulir berhenti 3 detik;
 * - ketuk baris untuk lompat ke bagian itu; jeda instrumental tampil sebagai tiga titik yang "bernapas".
 */
@Composable
fun SyncedLyrics(lyrics: Lyrics?, loading: Boolean, clock: LongState, onSeek: (Long) -> Unit, modifier: Modifier = Modifier, bottomPadding: Dp = 160.dp) {
    when {
        lyrics == null || loading -> LyricsMessage(if (loading) "Memuat lirik…" else "", modifier)
        lyrics.lines.none { it.text.isNotBlank() } -> LyricsMessage("Lirik belum tersedia untuk lagu ini.", modifier)
        !lyrics.synced -> PlainLyrics(lyrics.lines, modifier, bottomPadding)
        else -> Synced(lyrics.lines, clock, onSeek, modifier)
    }
}

@Composable
private fun Synced(lines: List<LyricLine>, clock: LongState, onSeek: (Long) -> Unit, modifier: Modifier) {
    val ends = remember(lines) { ends(lines) }
    // Sedikit lebih awal (180 ms) supaya baris baru menyala tepat saat vokal mulai, bukan sesudahnya.
    val active by remember(lines) { derivedStateOf { val t = clock.longValue / 1000.0 + 0.18; lines.indexOfLast { it.time <= t } } }
    // Dibuka di tengah lagu: langsung mulai di baris aktif, bukan menggulir panjang dari baris pertama.
    val state = rememberLazyListState(initialFirstVisibleItemIndex = active.coerceAtLeast(0))
    val dragged by state.interactionSource.collectIsDraggedAsState()
    var freeze by remember { mutableStateOf(false) }
    LaunchedEffect(dragged) {
        if (dragged) freeze = true else if (freeze) {
            delay(3000)
            freeze = false
        }
    }
    BoxWithConstraints(modifier) {
        // Baris aktif berlabuh di ±22% tinggi area lirik; padding bawah memungkinkan baris terakhir naik ke sana.
        val anchor = maxHeight * 0.22f
        LaunchedEffect(active, freeze) {
            if (freeze) return@LaunchedEffect
            val target = active.coerceAtLeast(0)
            val info = state.layoutInfo.visibleItemsInfo.firstOrNull { it.index == target }
            if (info != null) {
                state.animateScrollBy(info.offset.toFloat(), spring(dampingRatio = 0.86f, stiffness = 60f))
            } else {
                state.scrollToItem(target)
            }
        }
        LazyColumn(
            state = state,
            contentPadding = PaddingValues(top = anchor, bottom = maxHeight - anchor),
            modifier = Modifier.fillMaxSize().fadeEdges(),
        ) {
            itemsIndexed(lines, key = { i, _ -> i }) { i, line ->
                LyricRow(line, i, active, freeze, clock, ends[i], onSeek)
            }
        }
    }
}

/** Baris lirik memudar di tepi atas & bawah area lirik (bukan terpotong keras). */
private fun Modifier.fadeEdges(): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        drawRect(
            Brush.verticalGradient(0f to Color.Transparent, 0.1f to Color.Black, 0.82f to Color.Black, 1f to Color.Transparent),
            blendMode = BlendMode.DstIn,
        )
    }

@Composable
private fun LyricRow(line: LyricLine, index: Int, active: Int, freeze: Boolean, clock: LongState, end: Double, onSeek: (Long) -> Unit) {
    val d = index - active
    val isActive = d == 0
    val dist = abs(d)
    val cascade = (min(dist, 6) * 45)
    val alpha by animateFloatAsState(
        when {
            freeze -> 0.72f
            isActive -> 1f
            d < 0 -> max(0.18f, 0.4f - 0.06f * (dist - 1))
            else -> max(0.16f, 0.5f - 0.07f * (dist - 1))
        },
        tween(620, cascade, EaseOutQuint),
        label = "lyricAlpha",
    )
    val scale by animateFloatAsState(if (isActive) 1f else 0.93f, spring(dampingRatio = 0.62f, stiffness = 170f), label = "lyricScale")
    val blur by animateDpAsState(if (freeze || isActive) 0.dp else (min(dist, 5) * 1.3f).dp, tween(640, cascade, EaseOutQuint), label = "lyricBlur")
    // Baris naik sedikit saat menjadi aktif (dorongan pegas), memberi kesan lirik "mengalir".
    val lift = remember { Animatable(0f) }
    LaunchedEffect(isActive) {
        if (isActive) {
            lift.snapTo(14f)
            lift.animateTo(0f, spring(dampingRatio = 0.7f, stiffness = 120f))
        }
    }
    Box(
        Modifier
            .fillMaxWidth()
            .pointerInput(line.time) { detectTapGestures { onSeek((line.time * 1000).toLong()) } }
            .graphicsLayer {
                this.alpha = alpha
                scaleX = scale
                scaleY = scale
                translationY = lift.value * density
                transformOrigin = TransformOrigin(0f, 0.5f)
            }
            .then(if (blur > 0.2.dp) Modifier.blur(blur, BlurredEdgeTreatment.Unbounded) else Modifier)
            .padding(horizontal = 28.dp, vertical = 9.dp),
    ) {
        when {
            line.text.isBlank() -> Interlude(isActive, line.time, end, clock)
            isActive && !freeze -> ActiveLine(line.text, line.time, end, clock)
            else -> BasicText(line.text, style = lyricStyle(Color.White))
        }
    }
}

private fun lyricStyle(color: Color, glow: Float = 0f) = AppText.title(29.sp, color).copy(
    lineHeight = 35.sp,
    shadow = if (glow > 0f) Shadow(Color.White.copy(alpha = 0.32f * glow), Offset.Zero, 26f) else null,
)

/** Kata-kata terisi bertahap: setiap kata punya jendela waktu sebanding panjangnya di dalam durasi nyanyi baris. */
@Composable
private fun ActiveLine(text: String, start: Double, end: Double, clock: LongState) {
    val words = remember(text) { text.split(' ').filter { it.isNotEmpty() } }
    val windows = remember(text, start, end) {
        val chars = words.sumOf { it.length + 1 }.toDouble()
        // Kecepatan nyanyi wajar ±11 huruf/detik; baris panjang memakai hampir seluruh jatahnya.
        val sing = min(end - start, max(1.1, chars * 0.085 + 0.5)) * 0.94
        var acc = 0.0
        words.map { w ->
            val from = start + sing * (acc / chars)
            acc += w.length + 1
            from to (start + sing * (acc / chars))
        }
    }
    val t = clock.longValue / 1000.0
    val lineProgress = ((t - start) / max(0.001, windows.last().second - start)).toFloat().coerceIn(0f, 1f)
    val annotated = buildAnnotatedString {
        words.forEachIndexed { i, w ->
            val (from, to) = windows[i]
            val p = ((t - from) / max(0.05, to - from)).toFloat().coerceIn(0f, 1f)
            val eased = 1f - (1f - p) * (1f - p)
            withStyle(SpanStyle(color = lerp(Dim, Color.White, eased))) { append(w) }
            if (i < words.lastIndex) append(' ')
        }
    }
    BasicText(annotated, style = lyricStyle(Color.White, glow = 0.35f + 0.65f * lineProgress))
}

/** Jeda instrumental: tiga titik membesar & terisi mengikuti sisa jeda, berdenyut pelan, lalu menghilang. */
@Composable
private fun Interlude(isActive: Boolean, start: Double, end: Double, clock: LongState) {
    if (!isActive) {
        Spacer(Modifier.height(10.dp))
        return
    }
    val breathe by rememberInfiniteTransition(label = "breathe").animateFloat(0.92f, 1.08f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "b")
    val t = clock.longValue / 1000.0
    val p = ((t - start) / max(0.5, end - start)).toFloat().coerceIn(0f, 1f)
    val out = ((p - 0.9f) / 0.1f).coerceIn(0f, 1f)
    Row(
        Modifier.padding(vertical = 6.dp).graphicsLayer { scaleX = breathe * (1f - out * 0.6f); scaleY = scaleX; alpha = 1f - out; transformOrigin = TransformOrigin(0f, 0.5f) },
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        repeat(3) { i ->
            val fill = ((p * 3f) - i).coerceIn(0f, 1f)
            Box(Modifier.size(13.dp).background(Color.White.copy(alpha = 0.3f + 0.7f * fill), CircleShape))
        }
    }
}

@Composable
private fun PlainLyrics(lines: List<LyricLine>, modifier: Modifier, bottomPadding: Dp) {
    Column(modifier.fadeEdges().verticalScroll(rememberScrollState()).padding(top = 24.dp, bottom = bottomPadding)) {
        BasicText("Lirik tidak bersinkron", style = AppText.micro(Color.White.copy(alpha = 0.55f)), modifier = Modifier.padding(horizontal = 28.dp, vertical = 6.dp))
        lines.forEach { l ->
            if (l.text.isBlank()) Spacer(Modifier.height(18.dp))
            else BasicText(l.text, style = AppText.title(24.sp, Color.White.copy(alpha = 0.86f)).copy(lineHeight = 31.sp), modifier = Modifier.padding(horizontal = 28.dp, vertical = 5.dp))
        }
    }
}

@Composable
private fun LyricsMessage(text: String, modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(Icons.Rounded.Lyrics, null, Modifier.size(34.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.5f)))
            if (text.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                BasicText(text, style = AppText.body(15.sp, Color.White.copy(alpha = 0.7f), 600))
            }
        }
    }
}
