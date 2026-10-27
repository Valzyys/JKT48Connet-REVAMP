package app.jkt48connect.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.NorthEast
import androidx.compose.material.icons.rounded.WifiTetheringError
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.ui.input.pointer.PointerEventPass
import app.jkt48connect.core.Api
import app.jkt48connect.core.Images
import app.jkt48connect.core.fmtCountdown
import app.jkt48connect.core.fmtNum
import app.jkt48connect.core.parseInstant
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/** Teks satu baris (atau beberapa) tanpa Material. */
@Composable
fun Txt(text: String, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) =
    BasicText(text, modifier, style, overflow = TextOverflow.Ellipsis, maxLines = maxLines)

/** Logo salib piksel JKT48Connect (grid 5×5, 12 piksel). `assemble` = piksel terbang lalu tersusun. */
@Composable
fun PixelLogo(size: Dp, modifier: Modifier = Modifier, color: Color = LocalColors.current.brand, assemble: Boolean = false) {
    val progress = remember { Animatable(if (assemble) 0f else 1f) }
    if (assemble) LaunchedEffect(Unit) { progress.animateTo(1f, tween(1100)) }
    Canvas(modifier.size(size)) {
        val cell = this.size.minDimension / 5f
        PIXELS.forEachIndexed { i, (x, y) ->
            // Tiap piksel mulai sedikit lebih lambat dan terbang dari arah tetap.
            val local = ((progress.value * 1.5f) - i * 0.04f).coerceIn(0f, 1f)
            val e = 1f - (1f - local) * (1f - local) * (1f - local)
            val fx = FROM[i].first * cell * 6f * (1f - e)
            val fy = FROM[i].second * cell * 6f * (1f - e)
            drawRoundRect(
                color.copy(alpha = color.alpha * (0.2f + 0.8f * e)),
                topLeft = Offset(x * cell + fx, y * cell + fy),
                size = Size(cell * 0.9f, cell * 0.9f),
                cornerRadius = CornerRadius(cell * 0.18f),
            )
        }
    }
}

private val PIXELS = listOf(2 to 0, 1 to 1, 2 to 1, 3 to 1, 0 to 2, 1 to 2, 3 to 2, 4 to 2, 1 to 3, 2 to 3, 3 to 3, 2 to 4)
private val FROM = listOf(-0.6f to -1f, -1f to -0.4f, 0.2f to -1f, 1f to -0.7f, -1f to 0.1f, -0.5f to 0.8f, 0.9f to 0.3f, 1f to -0.1f, -0.8f to 1f, 0.1f to 1f, 0.7f to 0.9f, -0.2f to 1f)

/** Empat batang sinyal ala ponsel — motif "Fan Signal". */
@Composable
fun SignalBars(modifier: Modifier = Modifier, color: Color = LocalColors.current.brand, height: Dp = 12.dp, active: Boolean = true) {
    val t = if (active) rememberInfiniteTransition(label = "signal").animateFloat(0f, 1f, infiniteRepeatable(tween(1400, easing = LinearEasing)), label = "t") else null
    Canvas(modifier.size(height * 1.15f, height)) {
        val w = size.height * 0.22f
        for (i in 0 until 4) {
            val base = size.height * (0.3f + 0.7f * (i + 1) / 4f)
            val k = t?.let { 0.55f + 0.45f * abs(sin(it.value * 2 * PI.toFloat() + i)) } ?: 1f
            val h = base * k
            drawRoundRect(
                color.copy(alpha = if (active) 1f else 0.35f),
                topLeft = Offset(i * (w + size.height * 0.07f), size.height - h),
                size = Size(w, h),
                cornerRadius = CornerRadius(1.5f),
            )
        }
    }
}

/** Label mikro (mono, huruf besar, renggang) dengan titik merah opsional. */
@Composable
fun Micro(text: String, modifier: Modifier = Modifier, color: Color = LocalColors.current.inkSoft, dot: Boolean = false, size: Float = 10.5f) {
    val c = LocalColors.current
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        if (dot) {
            Box(Modifier.size(6.dp).background(c.brand, CircleShape))
            Spacer(Modifier.width(6.dp))
        }
        Txt(text.uppercase(), AppText.micro(color, size.sp), maxLines = 1)
    }
}

/** Kepala halaman tab ala iOS: label kecil abu (huruf besar) + judul besar tebal + elemen kanan opsional. */
@Composable
fun PageHeader(label: String, title: String, horizontal: Dp = 20.dp, trailing: (@Composable () -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(horizontal, 6.dp, horizontal, 16.dp).staggerIn(0), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Txt(label.uppercase(), AppText.body(12.sp, c.inkSoft, 700).copy(letterSpacing = 0.04.em), maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Txt(title, AppText.title(34.sp, c.ink), maxLines = 1)
        }
        trailing?.invoke()
    }
}

/** Judul bagian ala iOS: judul tebal + keterangan abu, dan "Semua ›" berwarna aksen di kanan. */
@Composable
fun SectionHead(label: String, title: String, onMore: (() -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(20.dp, 28.dp, 16.dp, 10.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Txt(title, AppText.title(22.sp, c.ink), maxLines = 1)
            Txt(label, AppText.body(13.sp, c.inkSoft, 500), maxLines = 1)
        }
        if (onMore != null) {
            Row(Modifier.pressable(onMore).padding(start = 12.dp, top = 6.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt("Semua", AppText.body(15.sp, c.brand, 600))
                Image(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(c.brand))
            }
        }
    }
}

/** Grup ala iOS (inset grouped): satu kartu membulat berisi baris-baris yang dipisah garis rambut. */
@Composable
fun InsetGroup(modifier: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(modifier.padding(horizontal = 16.dp).fillMaxWidth().appCard(20.dp), content = content)
}

/** Garis rambut antar baris dalam [InsetGroup], menjorok dari kiri seperti daftar iOS. */
@Composable
fun GroupDivider(start: Dp = 16.dp) {
    val c = LocalColors.current
    Box(Modifier.padding(start = start).fillMaxWidth().height(0.6.dp).background(c.line))
}

/** Baris daftar ala iOS: elemen kiri, judul + keterangan, nilai kanan, dan chevron. */
@Composable
fun GroupRow(
    title: String,
    subtitle: String = "",
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = LocalColors.current
    Row(
        modifier.fillMaxWidth().then(if (onClick != null) Modifier.pressable(onClick, 0.985f) else Modifier).padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.let {
            it()
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Txt(title, AppText.body(15.5.sp, c.ink, 700), maxLines = 1)
            if (subtitle.isNotEmpty()) Txt(subtitle, AppText.body(12.5.sp, c.inkSoft), maxLines = 2)
        }
        trailing?.let {
            Spacer(Modifier.width(8.dp))
            it()
        }
        if (onClick != null) Image(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.inkSoft.copy(alpha = 0.6f)))
    }
}

/** Kartu biasa (bukan kaca): isian lembut, garis rambut di tema gelap. */
fun Modifier.card(color: Color, line: Color, dark: Boolean, radius: Dp = 22.dp): Modifier {
    val shape = RoundedCornerShape(radius)
    return clip(shape).background(color).then(if (dark) Modifier.border(0.8.dp, line, shape) else Modifier)
}

@Composable
fun Modifier.appCard(radius: Dp = 22.dp): Modifier {
    val c = LocalColors.current
    return card(c.card, c.line, c.dark, radius)
}

/** Ditekan: mengecil sedikit lalu membal (pegas), tanpa ripple. */
fun Modifier.pressable(onClick: () -> Unit, scale: Float = 0.97f): Modifier = composed {
    var down by remember { mutableStateOf(false) }
    val s by animateFloatAsState(if (down) scale else 1f, spring(if (down) 1f else 0.5f, if (down) 1200f else 400f), label = "press")
    this
        .graphicsLayer { scaleX = s; scaleY = s }
        .pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown(false, PointerEventPass.Initial)
                down = true
                waitForUpOrCancellation(PointerEventPass.Initial)
                down = false
            }
        }
        .clickable(interactionSource = null, indication = null, onClick = onClick)
}

/** Masuk bertahap: naik sedikit + memudar, berurutan sesuai index. */
fun Modifier.staggerIn(index: Int, step: Int = 50): Modifier = composed {
    val p = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay((index.coerceIn(0, 12) * step).toLong())
        p.animateTo(1f, tween(420))
    }
    graphicsLayer {
        val e = 1f - (1f - p.value) * (1f - p.value) * (1f - p.value)
        alpha = p.value
        translationY = (1f - e) * 24.dp.toPx()
    }
}

/** Gambar jaringan dengan placeholder dan cadangan inisial; diperkecil sesuai ukuran tampil. */
@Composable
fun NetImage(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.TopCenter,
    fallback: String = "",
) {
    val c = LocalColors.current
    var width by remember { mutableStateOf(0) }
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    val alpha = remember(url) { Animatable(0f) }
    LaunchedEffect(url, width) {
        if (width == 0 || url.isEmpty()) {
            failed = url.isEmpty()
            return@LaunchedEffect
        }
        val cached = Images.cached(Api.imageUrl(url), width)
        if (cached != null) {
            bitmap = cached.asImageBitmap()
            alpha.snapTo(1f)
            return@LaunchedEffect
        }
        val b = Images.load(url, width)
        if (b == null) failed = true else {
            bitmap = b.asImageBitmap()
            alpha.animateTo(1f, tween(300))
        }
    }
    Box(modifier.background(c.surface).onSizeChanged { if (it.width > 0) width = it.width }, contentAlignment = Alignment.Center) {
        val b = bitmap
        if (b != null) {
            Image(b, null, Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha.value }, alignment = alignment, contentScale = contentScale)
        } else if (failed && fallback.isNotEmpty()) {
            Txt(fallback.take(1).uppercase(), AppText.display(28.sp, c.brand))
        }
    }
}

/** Gambar selebar wadah dengan tinggi mengikuti rasio aslinya (untuk gambar di isi berita). */
@Composable
fun AutoImage(url: String, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    var width by remember { mutableStateOf(0) }
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    LaunchedEffect(url, width) {
        if (width == 0) return@LaunchedEffect
        val b = Images.cached(Api.imageUrl(url), width) ?: Images.load(url, width)
        if (b == null) failed = true else bitmap = b.asImageBitmap()
    }
    val b = bitmap
    when {
        b != null -> Image(b, null, modifier.fillMaxWidth().aspectRatio(b.width.toFloat() / b.height).clip(RoundedCornerShape(18.dp)), contentScale = ContentScale.Fit)
        failed -> Unit
        else -> Box(modifier.fillMaxWidth().aspectRatio(16f / 9f).onSizeChanged { if (it.width > 0) width = it.width }.clip(RoundedCornerShape(18.dp)).background(c.surface))
    }
}

/** Kotak abu yang berdenyut selama data dimuat. */
@Composable
fun Skeleton(modifier: Modifier = Modifier, radius: Dp = 18.dp) {
    val c = LocalColors.current
    val a by rememberInfiniteTransition(label = "sk").animateFloat(0.55f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
    Box(modifier.graphicsLayer { alpha = a }.clip(RoundedCornerShape(radius)).background(c.surface))
}

/** Pil kecil berwarna (kategori jadwal, status). */
@Composable
fun Pill(text: String, bg: Color, fg: Color) {
    Box(Modifier.background(bg, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp)) {
        Txt(text.uppercase(), AppText.micro(fg, 9.5.sp), maxLines = 1)
    }
}

@Composable
fun CategoryPill(category: String) {
    val c = LocalColors.current
    when (category) {
        "exclusive" -> Pill("Exclusive", c.blush, c.brand)
        "general" -> Pill("Event", c.surface, c.inkSoft)
        else -> Pill("Show", c.butter, c.butterInk)
    }
}

/** Hitung mundur yang berdetak tiap detik. */
@Composable
fun Countdown(iso: String, style: TextStyle) {
    val target = remember(iso) { parseInstant(iso)?.toEpochMilli() } ?: return
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            now = System.currentTimeMillis()
        }
    }
    Txt(fmtCountdown(target - now), style, maxLines = 1)
}

/** Angka yang menghitung naik saat pertama muncul. */
@Composable
fun CountUp(value: Int?, style: TextStyle) {
    if (value == null) {
        Txt("–", style)
        return
    }
    val a = remember { Animatable(0f) }
    LaunchedEffect(value) { a.animateTo(value.toFloat(), tween(1200)) }
    Txt(fmtNum(a.value.toInt()), style, maxLines = 1)
}

/** Pesan gagal + tombol coba lagi. */
@Composable
fun ErrorRetry(error: Throwable, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Image(Icons.Rounded.WifiTetheringError, null, Modifier.size(36.dp), colorFilter = ColorFilter.tint(c.brand))
        Spacer(Modifier.height(10.dp))
        Txt(error.message ?: "Terjadi kesalahan", AppText.body(14.sp, c.inkSoft).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
        Spacer(Modifier.height(12.dp))
        Box(Modifier.pressable(onRetry).background(c.brandGradient, CircleShape).padding(horizontal = 20.dp, vertical = 11.dp)) {
            Txt("Coba lagi", AppText.body(14.sp, Color.White, 800))
        }
    }
}

/** Baris tombol kecil berpanah (dipakai di beberapa kartu). */
@Composable
fun ArrowCircle(modifier: Modifier = Modifier, bg: Color, fg: Color, size: Dp = 30.dp) {
    Box(modifier.size(size).background(bg, CircleShape), contentAlignment = Alignment.Center) {
        Image(Icons.Rounded.NorthEast, null, Modifier.size(size * 0.5f), colorFilter = ColorFilter.tint(fg))
    }
}

/** Gradasi gelap bawah untuk teks di atas foto. */
val PhotoScrim = Brush.verticalGradient(0.45f to Color.Transparent, 1f to Color(0xCC000000))

@Composable
fun RowScope.Gap(w: Dp) = Spacer(Modifier.width(w))

@Composable
fun VGap(h: Dp) = Spacer(Modifier.height(h))

/** Latar ambient: cahaya merah/merah muda yang melayang pelan, supaya kaca punya warna untuk dibiaskan. */
@Composable
fun Ambient(modifier: Modifier = Modifier) {
    val c = LocalColors.current
    val t by rememberInfiniteTransition(label = "amb").animateFloat(0f, (2 * PI).toFloat(), infiniteRepeatable(tween(22_000, easing = LinearEasing)), label = "t")
    Canvas(modifier.fillMaxSize()) {
        drawRect(c.bg)
        val w = size.width
        val h = size.height
        fun blob(x: Float, y: Float, r: Float, color: Color) =
            drawCircle(Brush.radialGradient(listOf(color, color.copy(alpha = 0f)), Offset(x, y), r), r, Offset(x, y))
        val d = c.dark
        blob(w * (0.12f + 0.06f * sin(t)), h * (0.02f + 0.03f * kotlin.math.cos(t)), w * 0.85f, (if (d) Color(0xFFE1243A) else Color(0xFFFF4A5F)).copy(alpha = if (d) 0.26f else 0.16f))
        blob(w * (0.95f + 0.05f * kotlin.math.cos(t * 1.3f)), h * (0.16f + 0.04f * sin(t)), w * 0.65f, (if (d) Color(0xFF8A1B4A) else Color(0xFFFF9AAE)).copy(alpha = if (d) 0.24f else 0.20f))
        blob(w * (0.3f + 0.1f * sin(t * 0.7f)), h * (0.62f + 0.04f * kotlin.math.cos(t)), w * 0.75f, (if (d) Color(0xFF4A1638) else Color(0xFFFFC2A8)).copy(alpha = if (d) 0.18f else 0.14f))
    }
}
