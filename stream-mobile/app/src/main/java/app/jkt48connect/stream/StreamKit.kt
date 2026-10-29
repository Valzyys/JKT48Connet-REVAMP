package app.jkt48connect.stream

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.shapes.Capsule
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sin

/*
 * Kit Stream: format, pemuat data, dan komponen visual yang diport dari aplikasi JKT48Connect 2.6.1
 * (yang sendirinya meniru aplikasi iPhone): judul besar, judul bagian "Semua ›", grup inset, kartu kaca
 * putih tembus, tombol kaca, masuk bertahap, dan tarik untuk memuat ulang dengan logo piksel.
 */

// ---------------------------------------------------------------- Format

private val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
private val ID_LOCALE: Locale = Locale.forLanguageTag("id-ID")

fun parseInstant(value: String): Instant? =
    runCatching { Instant.parse(value) }.getOrNull() ?: runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()

fun fmtWib(value: String, pattern: String): String =
    parseInstant(value)?.let { DateTimeFormatter.ofPattern(pattern, ID_LOCALE).withZone(WIB).format(it) } ?: ""

fun fmtTime(value: String): String = fmtWib(value, "HH.mm")

fun timeAgo(value: String): String {
    val at = parseInstant(value) ?: return ""
    val s = (System.currentTimeMillis() - at.toEpochMilli()) / 1000
    return when {
        s < 60 -> "baru saja"
        s < 3600 -> "${s / 60} menit lalu"
        s < 86_400 -> "${s / 3600} jam lalu"
        else -> "${s / 86_400} hari lalu"
    }
}

/** Durasi live: "45m" atau "1j 20m". */
fun fmtDuration(ms: Long): String {
    val m = ms / 60_000
    return if (m >= 60) "${m / 60}j ${m % 60}m" else "${m}m"
}

/** Angka ringkas: 980, 1,2rb, 3,4jt. */
fun fmtCompact(n: Long): String = when {
    n >= 1_000_000 -> String.format(ID_LOCALE, "%.1fjt", n / 1_000_000.0)
    n >= 1_000 -> String.format(ID_LOCALE, "%.1frb", n / 1_000.0)
    else -> n.toString()
}

fun rupiah(n: Long): String = "Rp" + String.format(ID_LOCALE, "%,d", n)

/** Hitung mundur: "2h 4j" bila lebih dari sehari, selain itu "04:12:09". */
fun fmtCountdown(ms: Long): String {
    if (ms <= 0) return "Sekarang"
    val s = ms / 1000
    val d = s / 86_400
    return if (d > 0) "${d}h ${s % 86_400 / 3600}j" else "%02d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60)
}

/** Waktu pemutar: "04:12" atau "1:04:12". */
fun clock(ms: Long): String {
    val s = ms / 1000
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%02d:%02d".format(s / 60, s % 60)
}

fun platformName(platform: String): String = when (platform.lowercase(Locale.ROOT)) {
    "idn" -> "IDN Live"
    "showroom" -> "Showroom"
    else -> "Live"
}

fun planName(plan: String): String = when (plan) {
    "weekly" -> "Pass Mingguan"
    "monthly" -> "Pass Bulanan"
    "yearly" -> "Pass Tahunan"
    "show" -> "Tiket satu show"
    "membership" -> "Membership"
    else -> plan.replaceFirstChar { it.uppercase() }
}

fun JSONArray.rows(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }

// ---------------------------------------------------------------- Data

/** Data terakhir per alamat, supaya halaman yang dibuka ulang langsung tampil lalu diperbarui di latar. */
object StreamCache {
    val lists = mutableMapOf<String, List<JSONObject>>()
    val docs = mutableMapOf<String, JSONObject>()
}

/** Daftar dari server: muat ulang, muat-lanjut (halaman berikutnya), dan pesan galat. */
@Stable
class Feed(private val path: (Int) -> String, private val paged: Boolean) {
    var rows by mutableStateOf(StreamCache.lists[path(1)].orEmpty())
    var loading by mutableStateOf(rows.isEmpty())
    var error by mutableStateOf("")
    var end by mutableStateOf(!paged)
    private var page = 1
    private var fetching = false

    suspend fun refresh() {
        runCatching { StreamApi.request(path(1)) }
            .onSuccess {
                val batch = it.optJSONArray("items")?.rows().orEmpty()
                rows = batch
                page = 1
                end = !paged || batch.isEmpty()
                error = ""
                StreamCache.lists[path(1)] = batch
            }
            .onFailure { error = it.message.orEmpty() }
        loading = false
    }

    suspend fun more() {
        if (end || fetching) return
        fetching = true
        runCatching { StreamApi.request(path(page + 1)) }
            .onSuccess {
                val batch = it.optJSONArray("items")?.rows().orEmpty()
                if (batch.isEmpty()) end = true else {
                    page++
                    rows = (rows + batch).distinctBy { r -> r.optString("id") }
                }
            }
            .onFailure { error = it.message.orEmpty() }
        fetching = false
    }
}

@Composable
fun rememberFeed(key: String, reload: Int, pollMs: Long = 0L, paged: Boolean = false, path: (Int) -> String): Feed {
    val feed = remember(key) { Feed(path, paged) }
    LaunchedEffect(feed, reload) {
        while (true) {
            feed.refresh()
            if (pollMs <= 0L) break
            delay(pollMs)
        }
    }
    return feed
}

/** Satu dokumen dari server (mis. profil). */
@Stable
class Doc(private val path: String) {
    var data by mutableStateOf(StreamCache.docs[path])
    var error by mutableStateOf("")

    suspend fun refresh() {
        runCatching { StreamApi.request(path) }
            .onSuccess { data = it; error = ""; StreamCache.docs[path] = it }
            .onFailure { error = it.message.orEmpty() }
    }
}

@Composable
fun rememberDoc(path: String, reload: Int): Doc {
    val doc = remember(path) { Doc(path) }
    LaunchedEffect(doc, reload) { doc.refresh() }
    return doc
}

/** Muat halaman berikutnya saat daftar mendekati akhir. */
@Composable
fun LoadMoreOnEnd(state: LazyListState, feed: Feed) {
    LaunchedEffect(state, feed) {
        snapshotFlow {
            val info = state.layoutInfo
            info.totalItemsCount > 0 && (info.visibleItemsInfo.lastOrNull()?.index ?: 0) >= info.totalItemsCount - 3
        }.distinctUntilChanged().collect { near -> if (near && feed.rows.isNotEmpty()) feed.more() }
    }
}

// ---------------------------------------------------------------- Tata letak

/** Jarak isi dari bilah atas (52dp + status bar) dan tab bar mengambang di bawah. */
val LocalInsets = staticCompositionLocalOf { PaddingValues(0.dp) }

/** Halaman detail: isi menjorok 16dp di kiri-kanan. */
@Composable
fun detailPadding(): PaddingValues {
    val insets = LocalInsets.current
    return PaddingValues(start = 16.dp, end = 16.dp, top = insets.calculateTopPadding() + 6.dp, bottom = insets.calculateBottomPadding())
}

@Composable fun VGap(h: Dp) = Spacer(Modifier.height(h))

@Composable fun RowScope.Gap(w: Dp) = Spacer(Modifier.width(w))

// ---------------------------------------------------------------- Teks & logo

@Composable
fun Txt(text: String, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) =
    BasicText(text, modifier, style, overflow = TextOverflow.Ellipsis, maxLines = maxLines)

/** Label mikro (mono, huruf besar, renggang). */
@Composable
fun Micro(text: String, modifier: Modifier = Modifier, color: Color = LocalColors.current.inkSoft, size: Float = 10.5f) {
    Txt(text.uppercase(), AppText.micro(color, size.sp), modifier, maxLines = 1)
}

private val LOGO_PIXELS = listOf(2 to 0, 1 to 1, 2 to 1, 3 to 1, 0 to 2, 1 to 2, 3 to 2, 4 to 2, 1 to 3, 2 to 3, 3 to 3, 2 to 4)
private val LOGO_FROM = listOf(-0.6f to -1f, -1f to -0.4f, 0.2f to -1f, 1f to -0.7f, -1f to 0.1f, -0.5f to 0.8f, 0.9f to 0.3f, 1f to -0.1f, -0.8f to 1f, 0.1f to 1f, 0.7f to 0.9f, -0.2f to 1f)

/** Logo salib piksel JKT48Connect (grid 5×5). `assemble` = piksel terbang lalu tersusun. */
@Composable
fun PixelLogo(size: Dp, modifier: Modifier = Modifier, color: Color = LocalColors.current.brand, assemble: Boolean = false) {
    val progress = remember { Animatable(if (assemble) 0f else 1f) }
    if (assemble) LaunchedEffect(Unit) { progress.animateTo(1f, tween(1100)) }
    Canvas(modifier.size(size)) {
        val cell = this.size.minDimension / 5f
        LOGO_PIXELS.forEachIndexed { i, (x, y) ->
            val local = ((progress.value * 1.5f) - i * 0.04f).coerceIn(0f, 1f)
            val e = 1f - (1f - local) * (1f - local) * (1f - local)
            drawRoundRect(
                color.copy(alpha = color.alpha * (0.2f + 0.8f * e)),
                topLeft = Offset(x * cell + LOGO_FROM[i].first * cell * 6f * (1f - e), y * cell + LOGO_FROM[i].second * cell * 6f * (1f - e)),
                size = Size(cell * 0.9f, cell * 0.9f),
                cornerRadius = CornerRadius(cell * 0.18f),
            )
        }
    }
}

/** Empat batang sinyal: motif "Fan Signal". */
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

/** Logo piksel yang berputar: indikator memuat. */
@Composable
fun Spinner(size: Dp = 22.dp, color: Color = LocalColors.current.brand) {
    val t by rememberInfiniteTransition(label = "spin").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "r")
    PixelLogo(size, Modifier.graphicsLayer { rotationZ = t }, color)
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(36.dp), contentAlignment = Alignment.Center) { Spinner() }
}

// ---------------------------------------------------------------- Kepala halaman

/**
 * Kepala halaman gaya website JKT48Connect: nomor merah "01 ——" dengan label mikro, judul condensed besar
 * huruf kapital, dan "/ jumlah" merah di sebelahnya.
 */
@Composable
fun PageHeader(index: String, title: String, label: String = "", count: String = "", trailing: (@Composable () -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(20.dp, 6.dp, 16.dp, 14.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Txt(index, AppText.mono(12.sp, c.brand, androidx.compose.ui.text.font.FontWeight.SemiBold))
                Gap(8.dp)
                Box(Modifier.width(22.dp).height(1.5.dp).background(c.brand))
                if (label.isNotEmpty()) {
                    Gap(8.dp)
                    Micro(label)
                }
            }
            VGap(4.dp)
            Row(verticalAlignment = Alignment.Bottom) {
                Txt(title.uppercase(), AppText.display(50.sp, c.ink), maxLines = 1)
                if (count.isNotEmpty()) {
                    Gap(8.dp)
                    Txt("/ $count", AppText.display(28.sp, c.brand), Modifier.padding(bottom = 6.dp), maxLines = 1)
                }
            }
        }
        trailing?.invoke()
    }
}

/** Judul bagian: label merah, judul condensed + "/ jumlah", dan tombol panah di lingkaran tinta. */
@Composable
fun SectionHead(label: String, title: String, count: String = "", onMore: (() -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(20.dp, 28.dp, 16.dp, 12.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Micro(label, color = c.brand)
            VGap(2.dp)
            Row(verticalAlignment = Alignment.Bottom) {
                Txt(title.uppercase(), AppText.display(28.sp, c.ink), maxLines = 1)
                if (count.isNotEmpty()) Txt("  / $count", AppText.display(18.sp, c.inkSoft), Modifier.padding(bottom = 3.dp), maxLines = 1)
            }
        }
        if (onMore != null) {
            LiquidIconButton(StreamIcons.ArrowOut, onMore, size = 40.dp, iconSize = 18.dp, iconColor = c.brand, fill = glassFill(), contentDescription = "Semua")
        }
    }
}

// ---------------------------------------------------------------- Kartu & grup

/**
 * Kaca isi seperti aplikasi iPhone: putih tembus pandang di atas latar ambient, tepi terang setipis rambut,
 * dan bayangan lembut. Tanpa blur per kartu supaya daftar panjang tetap ringan.
 */
@Composable
fun Modifier.glassCard(radius: Dp = 24.dp, tint: Color = Color.Unspecified): Modifier {
    val c = LocalColors.current
    val shape = RoundedCornerShape(radius)
    val fill = when {
        tint.isSpecified -> tint
        c.dark -> Color.White.copy(alpha = 0.08f)
        else -> Color.White.copy(alpha = 0.62f)
    }
    val edge = if (c.dark) Color.White.copy(alpha = 0.14f) else Color.White.copy(alpha = 0.9f)
    return this
        .shadow(if (c.dark) 0.dp else 10.dp, shape, ambientColor = Color(0x14000000), spotColor = Color(0x14000000))
        .clip(shape)
        .background(fill)
        .border(0.7.dp, edge, shape)
}

/** Grup inset iOS dalam satu kartu kaca; baris dipisah garis rambut. */
@Composable
fun InsetGroup(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.padding(horizontal = 16.dp).fillMaxWidth().glassCard(24.dp), content = content)
}

@Composable
fun GroupDivider(start: Dp = 14.dp) {
    Box(Modifier.padding(start = start).fillMaxWidth().height(0.5.dp).background(LocalColors.current.line))
}

/** Baris daftar iOS: elemen kiri, judul + keterangan, elemen kanan, dan chevron opsional. */
@Composable
fun GroupRow(
    title: String,
    subtitle: String = "",
    modifier: Modifier = Modifier,
    titleColor: Color = LocalColors.current.ink,
    chevron: Boolean = false,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = LocalColors.current
    Row(
        modifier.fillMaxWidth().then(if (onClick != null) Modifier.pressable(onClick, 0.985f) else Modifier).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.let {
            it()
            Gap(12.dp)
        }
        Column(Modifier.weight(1f)) {
            Txt(title, AppText.body(15.sp, titleColor, 600), maxLines = 2)
            if (subtitle.isNotEmpty()) {
                VGap(2.dp)
                Txt(subtitle, AppText.mono(11.sp, c.inkSoft), maxLines = 1)
            }
        }
        trailing?.let {
            Gap(8.dp)
            it()
        }
        if (chevron) {
            Gap(4.dp)
            Image(StreamIcons.Chevron, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.inkSoft.copy(alpha = 0.6f)))
        }
    }
}

/** Ikon dalam kotak bulat kecil berwarna, untuk sisi kiri baris grup (seperti Pengaturan iPhone). */
@Composable
fun RowIcon(icon: ImageVector, bg: Color) {
    Box(Modifier.size(30.dp).clip(RoundedCornerShape(9.dp)).background(bg), contentAlignment = Alignment.Center) {
        Image(icon, null, Modifier.size(17.dp), colorFilter = ColorFilter.tint(Color.White))
    }
}

/** Kosong: ikon + teks di kartu kaca. */
@Composable
fun EmptyState(icon: ImageVector, text: String, modifier: Modifier = Modifier, action: String = "", onAction: (() -> Unit)? = null) {
    val c = LocalColors.current
    Column(modifier.padding(horizontal = 16.dp).fillMaxWidth().glassCard(24.dp).padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Image(icon, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(c.inkSoft))
        VGap(10.dp)
        Txt(text, AppText.body(14.sp, c.inkSoft).copy(textAlign = TextAlign.Center))
        if (onAction != null && action.isNotEmpty()) {
            VGap(14.dp)
            LiquidButton(onClick = onAction, modifier = Modifier.height(42.dp)) { Txt(action, AppText.body(14.sp, c.ink, 800)) }
        }
    }
}

/** Pesan gagal + tombol coba lagi. */
@Composable
fun ErrorRetry(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        PixelLogo(26.dp, color = c.inkSoft.copy(alpha = 0.5f))
        VGap(12.dp)
        Txt(message.ifEmpty { "Terjadi kesalahan" }, AppText.body(14.sp, c.inkSoft).copy(textAlign = TextAlign.Center))
        VGap(12.dp)
        LiquidButton(onClick = onRetry, modifier = Modifier.height(42.dp)) { Txt("Coba lagi", AppText.body(14.sp, c.ink, 800)) }
    }
}

/** Kotak yang berdenyut selama data dimuat. */
@Composable
fun Skeleton(modifier: Modifier = Modifier, radius: Dp = 18.dp) {
    val a by rememberInfiniteTransition(label = "sk").animateFloat(0.55f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
    Box(modifier.graphicsLayer { alpha = a }.clip(RoundedCornerShape(radius)).background(LocalColors.current.surface))
}

/** Pil kecil berwarna (status, kategori). */
@Composable
fun Pill(text: String, bg: Color, fg: Color) {
    Box(Modifier.background(bg, CircleShape).padding(horizontal = 8.dp, vertical = 3.dp)) {
        Txt(text.uppercase(), AppText.micro(fg, 9.5.sp), maxLines = 1)
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

/** Gradasi gelap bawah untuk teks di atas foto. */
val PhotoScrim = Brush.verticalGradient(0.4f to Color.Transparent, 1f to Color(0xCC000000))

/** Deret foto bulat yang saling menumpuk. */
@Composable
fun AvatarStack(images: List<String>, size: Dp = 26.dp, max: Int = 6, ring: Color = LocalColors.current.card, extraColor: Color = LocalColors.current.inkSoft) {
    val shown = images.take(max)
    val extra = images.size - shown.size
    Box(Modifier.height(size)) {
        shown.forEachIndexed { i, url ->
            Picture(url, Modifier.offset(x = size * 0.68f * i).size(size).clip(CircleShape).border(2.dp, ring, CircleShape))
        }
        if (extra > 0) Txt("+$extra", AppText.mono(11.sp, extraColor), Modifier.offset(x = size * 0.68f * shown.size + 4.dp, y = size * 0.2f))
    }
}

/** Titik merah berdenyut (penanda live di pemutar). */
@Composable
fun LiveDot(color: Color = Color(0xFFFF2D55)) {
    val a by rememberInfiniteTransition(label = "dot").animateFloat(0.35f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "a")
    Box(Modifier.size(8.dp).graphicsLayer { alpha = a }.background(color, CircleShape))
}

// ---------------------------------------------------------------- Gambar

/** Gambar jaringan: placeholder abu, memudar masuk, dan cadangan inisial bila gagal. */
@Composable
fun Picture(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alignment: Alignment = Alignment.Center,
    fallback: String = "",
) {
    val c = LocalColors.current
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    val alpha = remember(url) { Animatable(0f) }
    LaunchedEffect(url) {
        if (url.isEmpty()) {
            failed = true
            return@LaunchedEffect
        }
        val b = runCatching { StreamApi.bitmap(url) }.getOrNull()
        if (b == null) failed = true else {
            bitmap = b.asImageBitmap()
            alpha.animateTo(1f, tween(260))
        }
    }
    Box(modifier.background(c.surface), contentAlignment = Alignment.Center) {
        val b = bitmap
        when {
            b != null -> Image(b, null, Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha.value }, alignment = alignment, contentScale = contentScale)
            failed && fallback.isNotEmpty() -> Txt(fallback.take(1).uppercase(), AppText.display(28.sp, c.brand))
            failed -> PixelLogo(20.dp, color = c.inkSoft.copy(alpha = 0.3f))
        }
    }
}

// ---------------------------------------------------------------- Interaksi

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

/** Waktu pindah halaman terakhir; animasi masuk hanya diputar sesaat setelahnya. */
object Motion {
    @Volatile var lastNav = System.currentTimeMillis()
}

/** Masuk bertahap: naik sedikit + memudar, berurutan. Hanya ±1,2 detik setelah halaman dibuka. */
fun Modifier.staggerIn(index: Int, step: Int = 50): Modifier = composed {
    val fresh = remember { System.currentTimeMillis() - Motion.lastNav < 1200 }
    if (!fresh) return@composed this
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

/** Tombol utama merah. */
@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, onClick: () -> Unit) {
    LiquidButton(onClick, modifier.fillMaxWidth().height(54.dp), tint = LocalColors.current.brand) {
        icon?.let { Image(it, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Color.White)) }
        Txt(text, AppText.body(16.sp, Color.White, 800), maxLines = 1)
    }
}

/** Tombol kaca sekunder. */
@Composable
fun GlassButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, color: Color = LocalColors.current.ink, onClick: () -> Unit) {
    LiquidButton(onClick, modifier.height(50.dp)) {
        icon?.let { Image(it, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(color)) }
        Txt(text, AppText.body(15.sp, color, 800), maxLines = 1)
    }
}

/** Kolom isian kaca dengan label mikro dan petunjuk. */
@Composable
fun GlassField(
    label: String,
    value: String,
    hint: String,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    keyboard: KeyboardType = KeyboardType.Text,
    onValue: (String) -> Unit,
) {
    val c = LocalColors.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Micro(label)
        Box(Modifier.fillMaxWidth().glassCard(18.dp).padding(horizontal = 16.dp, vertical = 15.dp)) {
            if (value.isEmpty()) Txt(hint, AppText.body(16.sp, c.inkSoft.copy(alpha = 0.7f)), maxLines = 1)
            BasicTextField(
                value = value,
                onValueChange = onValue,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                textStyle = AppText.body(16.sp, c.ink, 600),
                cursorBrush = SolidColor(c.brand),
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard),
                visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            )
        }
    }
}

// ---------------------------------------------------------------- Tarik untuk memuat ulang

/** Tarik ke bawah untuk memuat ulang: lensa kaca bulat berisi logo piksel yang ikut turun dan berputar. */
@Composable
fun PullRefresh(onRefresh: suspend () -> Unit, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val scope = rememberCoroutineScope()
    val threshold = with(androidx.compose.ui.platform.LocalDensity.current) { 80.dp.toPx() }
    val pull = remember { Animatable(0f) }
    var refreshing by remember { mutableStateOf(false) }
    val refresh by rememberUpdatedState(onRefresh)
    val connection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (pull.value > 0f && available.y < 0f && !refreshing) {
                    val used = maxOf(available.y, -pull.value)
                    scope.launch { pull.snapTo(pull.value + used) }
                    return Offset(0f, used)
                }
                return Offset.Zero
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && available.y > 0f && !refreshing) {
                    val resist = 0.5f * (1f - (pull.value / (threshold * 2.2f)).coerceIn(0f, 0.85f))
                    scope.launch { pull.snapTo(pull.value + available.y * resist) }
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (refreshing || pull.value == 0f) return Velocity.Zero
                if (pull.value >= threshold) {
                    refreshing = true
                    pull.animateTo(threshold * 0.75f, spring(0.7f, 400f))
                    scope.launch {
                        try {
                            refresh()
                        } finally {
                            pull.animateTo(0f, spring(0.8f, 300f))
                            refreshing = false
                        }
                    }
                } else {
                    pull.animateTo(0f, spring(0.6f, 400f))
                }
                return Velocity.Zero
            }
        }
    }
    Box(modifier.fillMaxSize().nestedScroll(connection)) {
        Box(Modifier.fillMaxSize().graphicsLayer { translationY = pull.value * 0.6f }, content = content)
        if (pull.value > 1f || refreshing) {
            val spin = rememberInfiniteTransition(label = "pull").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "r")
            val p = (pull.value / threshold).coerceIn(0f, 1f)
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = (LocalInsets.current.calculateTopPadding() - 30.dp).coerceAtLeast(0.dp))
                    .offset { IntOffset(0, (pull.value * 0.6f).roundToInt()) }
                    .graphicsLayer {
                        alpha = p
                        scaleX = 0.6f + 0.4f * p
                        scaleY = 0.6f + 0.4f * p
                        rotationZ = if (refreshing) spin.value else p * 270f
                    }
                    .size(44.dp)
                    .glass(LocalBackdrop.current, Capsule(), glassFill(), lensHeight = 10.dp, lensAmount = 20.dp),
                contentAlignment = Alignment.Center,
            ) {
                PixelLogo(18.dp)
            }
        }
    }
}
