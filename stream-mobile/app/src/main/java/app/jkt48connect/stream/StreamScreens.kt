package app.jkt48connect.stream

import android.net.Uri
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

private val Ink = Color(0xFF1D1517)

/** Show yang paling dekat: sedang live, atau jadwal berikutnya (show yang baru mulai < 3 jam tetap dihitung). */
private fun nextShow(rows: List<JSONObject>): JSONObject? {
    rows.firstOrNull { it.optBoolean("isLive") }?.let { return it }
    val from = System.currentTimeMillis() - 3 * 3_600_000L
    return rows.filter { (parseInstant(it.optString("date"))?.toEpochMilli() ?: 0) >= from }
        .minByOrNull { parseInstant(it.optString("date"))?.toEpochMilli() ?: Long.MAX_VALUE }
}

/** Akhir masa aktif membership (epoch detik), atau null bila tidak ada. */
fun passUntil(me: JSONObject?): Long? =
    me?.optJSONArray("access")?.rows().orEmpty().filter { it.optString("kind") == "membership" }.maxOfOrNull { it.optLong("expires") }

/** Pilihan segmen kaca (pil kaca bertint merah yang bisa diseret). */
@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    LiquidTabs(
        items = options.map { TabItem(it) },
        selectedIndex = selected,
        onSelected = onSelect,
        height = 48.dp,
        segmented = true,
        modifier = modifier.padding(horizontal = 16.dp).fillMaxWidth(),
    )
}

/** Angka yang menghitung naik saat pertama muncul. */
@Composable
fun CountUp(value: Long?, style: TextStyle) {
    if (value == null || value <= 0) {
        Txt("–", style)
        return
    }
    val a = remember(value) { Animatable(0f) }
    LaunchedEffect(value) { a.animateTo(value.toFloat(), tween(1200)) }
    Txt(String.format(java.util.Locale.forLanguageTag("id-ID"), "%,d", a.value.toLong()), style, maxLines = 1)
}

// ---------------------------------------------------------------- Beranda

/**
 * Beranda Stream: hero "ON AIR" (carousel live yang berputar otomatis) atau "OFF AIR" (hitung mundur show),
 * ticker sinyal, tiga ubin cepat, Stream Pass, theater, dan replay.
 */
@Composable
fun HomeScreen() {
    val nav = LocalNav.current
    val c = LocalColors.current
    val live = rememberFeed("live", nav.reload, pollMs = 20_000L) { "/live" }
    val theater = rememberFeed("catalog", nav.reload) { "/catalog" }
    val recent = rememberFeed("recent", nav.reload, paged = true) { "/recent?page=$it" }
    val me = rememberDoc("/me", nav.reload)
    val show = nextShow(theater.rows)
    val until = passUntil(me.data)

    PullRefresh(onRefresh = {
        coroutineScope { listOf(async { live.refresh() }, async { theater.refresh() }, async { recent.refresh() }, async { me.refresh() }).awaitAll() }
    }) {
        LazyColumn(contentPadding = LocalInsets.current) {
            item {
                OnAirHero(
                    live = if (live.loading && live.rows.isEmpty()) null else live.rows,
                    show = show,
                    onWatch = { nav.push(Route.Watch(it)) },
                    onShow = { if (show != null) nav.push(Route.Theater(show)) else nav.tab = 2 },
                )
            }
            item {
                val ticks = buildList {
                    live.rows.forEach { add("LIVE · ${it.optString("title")} · ${platformName(it.optString("platform"))}") }
                    show?.let { add((if (it.optBoolean("isLive")) "THEATER TAYANG · " else "THEATER BERIKUTNYA · ") + "${it.optString("title")} · ${fmtWib(it.optString("date"), "EEE HH.mm")}") }
                    recent.rows.take(3).forEach { add("REPLAY · ${it.optString("title")} · ${fmtDuration(it.optLong("durationMs"))}") }
                }
                if (ticks.isNotEmpty()) Ticker(ticks)
            }
            item {
                Row(Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp).staggerIn(1), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    QuickTile("Live", Modifier.weight(1f), StreamIcons.Live, { nav.tab = 1 }) {
                        Txt("${live.rows.size}", AppText.display(30.sp, if (live.rows.isNotEmpty()) c.brand else c.ink))
                    }
                    QuickTile("Show", Modifier.weight(1.25f), StreamIcons.Timer, { if (show != null) nav.push(Route.Theater(show)) else nav.tab = 2 }) {
                        when {
                            show == null -> Txt("–", AppText.display(30.sp, c.ink))
                            show.optBoolean("isLive") -> Txt("TAYANG", AppText.display(30.sp, c.brand), maxLines = 1)
                            else -> Countdown(show.optString("date"), AppText.mono(17.sp, c.ink, FontWeight.SemiBold))
                        }
                    }
                    QuickTile("Pass", Modifier.weight(1f), StreamIcons.Pass, { nav.tab = 4 }) {
                        val days = until?.let { ((it * 1000 - System.currentTimeMillis()) / 86_400_000L).coerceAtLeast(0) }
                        Txt(if (days != null) "${days}H" else "BELI", AppText.display(30.sp, if (days != null) c.ink else c.brand))
                    }
                }
            }
            if (until == null && me.data != null) item { PassCard(me.data, Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp).staggerIn(2)) { nav.tab = 4 } }

            if (live.rows.size > 1) {
                item { SectionHead("IDN Live · Showroom", "Live sekarang", "${live.rows.size}") { nav.tab = 1 } }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(live.rows, key = { _, l -> l.optString("id") }) { i, l ->
                            LiveCard(l, Modifier.fillParentMaxWidth(0.8f).staggerIn(i), 230.dp) { nav.push(Route.Watch(l)) }
                        }
                    }
                }
            }

            item { SectionHead("Tiket Rp4.000 · Stream Pass", "Theater", if (theater.rows.isNotEmpty()) "${theater.rows.size}" else "") { nav.tab = 2 } }
            item {
                when {
                    theater.rows.isEmpty() && theater.loading -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(96.dp), 24.dp)
                    theater.rows.isEmpty() -> EmptyState(StreamIcons.Theater, theater.error.ifEmpty { "Jadwal theater berikutnya akan muncul di sini." })
                    else -> Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        theater.rows.take(3).forEachIndexed { i, t -> ShowTile(t, Modifier.staggerIn(i + 2)) { nav.push(Route.Theater(t)) } }
                    }
                }
            }

            item { SectionHead("Tanpa tunggu 72 jam", "Replay") { nav.tab = 3 } }
            item {
                val list = recent.rows.take(5)
                when {
                    list.isEmpty() && recent.loading -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(300.dp), 22.dp)
                    list.isEmpty() -> EmptyState(StreamIcons.Replay, recent.error.ifEmpty { "Replay member muncul setelah live selesai." })
                    else -> InsetGroup {
                        list.forEachIndexed { i, r ->
                            if (i > 0) GroupDivider(76.dp)
                            GroupRow(
                                title = r.optString("title"),
                                subtitle = "${platformName(r.optString("platform"))} · ${fmtWib(r.optString("start").ifEmpty { r.optString("date") }, "d MMM · HH.mm")}",
                                leading = { Picture(r.optString("avatar").ifEmpty { r.optString("image") }, Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)), fallback = r.optString("title")) },
                                trailing = { if (r.optLong("durationMs") > 0) Txt(fmtDuration(r.optLong("durationMs")), AppText.display(20.sp, c.ink)) },
                                onClick = { nav.push(Route.Recent(r)) },
                            )
                        }
                    }
                }
            }

            item {
                Column(Modifier.fillMaxWidth().padding(top = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PixelLogo(18.dp)
                    VGap(10.dp)
                    Txt("Fan-made · tidak berafiliasi dengan JKT48 Operation Team", AppText.mono(10.5.sp, c.inkSoft))
                }
            }
        }
    }
}

/**
 * Hero "ON AIR": kartu tinta dengan foto member yang sedang live, berganti otomatis seperti Stories
 * (garis progres di atas), nama raksasa, platform, dan tombol tonton. Tanpa live → "OFF AIR".
 */
@Composable
private fun OnAirHero(live: List<JSONObject>?, show: JSONObject?, onWatch: (JSONObject) -> Unit, onShow: () -> Unit) {
    val c = LocalColors.current
    when {
        live == null -> Skeleton(Modifier.padding(16.dp, 6.dp, 16.dp, 0.dp).fillMaxWidth().height(440.dp), 32.dp)
        live.isEmpty() -> OffAirHero(show, onShow)
        else -> {
            val pager = rememberPagerState { live.size }
            LaunchedEffect(pager, live.size) {
                while (live.size > 1) {
                    delay(4_500)
                    pager.animateScrollToPage((pager.currentPage + 1) % live.size)
                }
            }
            Box(
                Modifier
                    .padding(16.dp, 6.dp, 16.dp, 0.dp)
                    .fillMaxWidth()
                    .height(440.dp)
                    .shadow(26.dp, RoundedCornerShape(32.dp), ambientColor = c.brand, spotColor = c.brand)
                    .clip(RoundedCornerShape(32.dp))
                    .background(Ink)
                    .staggerIn(0),
            ) {
                HorizontalPager(pager, Modifier.fillMaxSize()) { p ->
                    val l = live[p]
                    // Foto direkam sebagai backdrop: chip & tombol di atasnya liquid glass yang membiaskan foto.
                    val photo = rememberLayerBackdrop()
                    Box(Modifier.fillMaxSize().pressable({ onWatch(l) }, 0.99f)) {
                        Box(Modifier.fillMaxSize().layerBackdrop(photo)) {
                            Picture(l.optString("image").ifEmpty { l.optString("avatar") }, Modifier.fillMaxSize(), alignment = Alignment.TopCenter, fallback = l.optString("title"))
                            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.45f), 0.25f to Color.Transparent, 0.5f to Color.Transparent, 1f to Ink.copy(alpha = 0.95f))))
                        }
                        Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
                            Row(
                                Modifier.glass(photo, Capsule(), Color.White.copy(alpha = 0.12f), blur = 4.dp, lensHeight = 8.dp, lensAmount = 16.dp, shadow = false)
                                    .padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                SignalBars(color = Color.White, height = 10.dp)
                                Gap(6.dp)
                                Txt(platformName(l.optString("platform")).uppercase(), AppText.micro(Color.White, 9.5.sp))
                            }
                            VGap(10.dp)
                            Txt(l.optString("title").uppercase(), AppText.display(58.sp, Color.White), maxLines = 1)
                            val sub = listOf(l.optString("liveTitle"), "mulai " + timeAgo(l.optString("date"))).filter { it.isNotBlank() && it != "mulai " }.joinToString(" · ")
                            if (sub.isNotEmpty()) Txt(sub, AppText.body(13.5.sp, Color.White.copy(alpha = 0.78f)), maxLines = 2)
                            VGap(14.dp)
                            LiquidButton(
                                onClick = { onWatch(l) },
                                modifier = Modifier.height(46.dp),
                                backdrop = photo,
                                tint = Color.White,
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Image(StreamIcons.Play, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
                                Txt("Tonton di aplikasi", AppText.body(14.sp, Ink, 800))
                            }
                        }
                    }
                }
                Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(16.dp)) {
                    if (live.size > 1) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            live.indices.forEach { i ->
                                Box(Modifier.weight(1f).height(3.dp).clip(CircleShape).background(if (i == pager.currentPage) Color.White else Color.White.copy(alpha = 0.3f)))
                            }
                        }
                        VGap(12.dp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.background(c.brandGradient, CircleShape).padding(horizontal = 12.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                            LiveDot(Color.White)
                            Gap(7.dp)
                            Txt("ON AIR", AppText.micro(Color.White, 10.5.sp))
                        }
                        Spacer(Modifier.weight(1f))
                        Txt("%02d / %02d".format(pager.currentPage + 1, live.size), AppText.mono(12.sp, Color.White.copy(alpha = 0.85f), FontWeight.SemiBold))
                    }
                }
            }
        }
    }
}

/** Belum ada yang live: kartu tinta "OFF / AIR" dengan show berikutnya dan hitung mundur besar. */
@Composable
private fun OffAirHero(show: JSONObject?, onShow: () -> Unit) {
    val c = LocalColors.current
    Box(
        Modifier
            .padding(16.dp, 6.dp, 16.dp, 0.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp))
            .background(Ink)
            .pressable(onShow, 0.99f)
            .staggerIn(0),
    ) {
        PixelLogo(210.dp, Modifier.align(Alignment.TopEnd).offset(60.dp, (-30).dp).graphicsLayer { rotationZ = 14f; alpha = 0.9f })
        Column(Modifier.padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SignalBars(color = Color.White.copy(alpha = 0.6f), height = 11.dp, active = false)
                Gap(8.dp)
                Micro("Belum ada yang live", color = Color.White.copy(alpha = 0.6f))
            }
            VGap(16.dp)
            Txt("OFF", AppText.display(72.sp, Color.White))
            Txt("AIR", AppText.display(72.sp, c.brand).copy(drawStyle = Stroke(width = 4f)))
            VGap(18.dp)
            if (show != null) {
                Micro(if (show.optBoolean("isLive")) "Theater sedang tayang" else "Theater berikutnya", color = Color.White.copy(alpha = 0.6f))
                VGap(4.dp)
                Txt(show.optString("title"), AppText.body(18.sp, Color.White, 800), maxLines = 1)
                VGap(6.dp)
                if (show.optBoolean("isLive")) Pill("● Tayang sekarang", c.brand, Color.White)
                else Countdown(show.optString("date"), AppText.mono(30.sp, Color.White, FontWeight.SemiBold))
            } else {
                Txt("Kabar live member dan jadwal theater muncul di sini.", AppText.body(14.sp, Color.White.copy(alpha = 0.75f)))
            }
            VGap(18.dp)
            Row(Modifier.background(Color.White, CircleShape).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt("Lihat jadwal", AppText.body(14.sp, Ink, 800))
                Gap(4.dp)
                Image(StreamIcons.Chevron, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(Ink))
            }
        }
    }
}

/** Ticker sinyal: pita merah dengan teks berjalan (live, theater, replay terbaru). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Ticker(items: List<String>) {
    val c = LocalColors.current
    Row(
        Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp).fillMaxWidth().height(42.dp)
            .glass(LocalBackdrop.current, Capsule(), Color.Transparent, tint = c.brand, lensHeight = 10.dp, lensAmount = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(Modifier.fillMaxHeight().background(Ink, CircleShape).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            SignalBars(color = Color.White, height = 11.dp)
            Gap(7.dp)
            Txt("SINYAL", AppText.micro(Color.White, 9.5.sp))
        }
        Txt(
            items.joinToString("     ✦     "),
            AppText.micro(Color.White, 10.5.sp),
            Modifier.weight(1f).padding(horizontal = 12.dp).basicMarquee(iterations = Int.MAX_VALUE, velocity = 40.dp),
            maxLines = 1,
        )
    }
}

/** Ubin cepat beranda: label mikro + ikon, nilai besar. */
@Composable
private fun QuickTile(label: String, modifier: Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, value: @Composable () -> Unit) {
    val c = LocalColors.current
    Column(modifier.height(86.dp).pressable(onClick).glassCard(22.dp).padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(icon, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(c.brand))
            Gap(6.dp)
            Micro(label, size = 9.5f)
        }
        value()
    }
}

/** Promosi Stream Pass untuk akun tanpa Pass: kartu tinta dengan logo piksel merah. */
@Composable
fun PassCard(me: JSONObject?, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    if (passUntil(me) != null) return
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(c.brandGradient).pressable(onClick)) {
        PixelLogo(120.dp, Modifier.align(Alignment.CenterEnd).offset(30.dp, 0.dp).graphicsLayer { rotationZ = -12f; alpha = 0.18f }, color = Color.White)
        Column(Modifier.padding(20.dp)) {
            Micro("Stream Pass", color = Color.White.copy(alpha = 0.7f))
            VGap(6.dp)
            Txt("SEMUA THEATER", AppText.display(30.sp, Color.White))
            Txt("SATU PASS", AppText.display(30.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
            VGap(8.dp)
            Txt("Mulai Rp10.000 / 7 hari · QRIS", AppText.mono(11.5.sp, Color.White.copy(alpha = 0.8f)))
            VGap(14.dp)
            Row(Modifier.background(Color.White, CircleShape).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt("Lihat paket", AppText.body(13.sp, c.brand, 800))
                Gap(4.dp)
                Image(StreamIcons.Chevron, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(c.brand))
            }
        }
    }
}

// ---------------------------------------------------------------- Kartu

/** Kartu besar member yang sedang live: foto penuh, pil kaca merah "LIVE · platform" yang membiaskan foto, dan "Tonton". */
@Composable
fun LiveCard(live: JSONObject, modifier: Modifier = Modifier, height: Dp = 260.dp, onClick: () -> Unit) {
    val photo = rememberLayerBackdrop()
    val sub = listOf(live.optString("liveTitle"), timeAgo(live.optString("date"))).filter { it.isNotEmpty() }.joinToString(" · ")
    Box(modifier.height(height).fillMaxWidth().pressable(onClick).clip(RoundedCornerShape(28.dp))) {
        Box(Modifier.fillMaxSize().layerBackdrop(photo)) {
            Picture(live.optString("image").ifEmpty { live.optString("avatar") }, Modifier.fillMaxSize(), alignment = Alignment.TopCenter, fallback = live.optString("title"))
            Box(Modifier.fillMaxSize().background(PhotoScrim))
        }
        Row(
            Modifier
                .padding(14.dp)
                .glass(photo, Capsule(), Color.Transparent, tint = Color(0xFFE1243A), lensHeight = 8.dp, lensAmount = 16.dp, shadow = false)
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SignalBars(color = Color.White, height = 11.dp)
            Gap(7.dp)
            Txt("LIVE · ${platformName(live.optString("platform")).uppercase()}", AppText.micro(Color.White))
        }
        Row(
            Modifier.align(Alignment.TopEnd).padding(14.dp).clip(Capsule()).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 11.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(StreamIcons.Play, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(Color.White))
            Gap(5.dp)
            Txt("TONTON", AppText.micro(Color.White))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(18.dp, 0.dp, 18.dp, 16.dp)) {
            Txt(live.optString("title").uppercase(), AppText.display(32.sp, Color.White), maxLines = 1)
            if (sub.isNotEmpty()) {
                VGap(4.dp)
                Txt(sub, AppText.body(13.sp, Color.White.copy(alpha = 0.75f)), maxLines = 1)
            }
        }
    }
}

/** Kartu theater: tanggal besar di kiri (merah bila < 24 jam lagi atau sedang tayang), status, judul, jam, lineup. */
@Composable
fun ShowTile(show: JSONObject, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val date = show.optString("date")
    val ms = parseInstant(date)?.toEpochMilli()?.minus(System.currentTimeMillis())
    val hot = show.optBoolean("isLive") || (ms != null && ms in 0..86_400_000)
    Row(modifier.fillMaxWidth().pressable(onClick).glassCard(24.dp).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(
            Modifier
                .width(60.dp)
                .clip(RoundedCornerShape(18.dp))
                .then(if (hot) Modifier.background(c.brandGradient) else Modifier.background(c.bg.copy(alpha = if (c.dark) 0.6f else 1f)))
                .padding(vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Txt(fmtWib(date, "d").ifEmpty { "–" }, AppText.display(28.sp, if (hot) Color.White else c.ink))
            VGap(2.dp)
            Txt(fmtWib(date, "MMM").uppercase(), AppText.micro(if (hot) Color.White.copy(alpha = 0.7f) else c.inkSoft, 9.5.sp))
        }
        Gap(14.dp)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShowPill(show)
                Gap(8.dp)
                Txt(fmtTime(date).let { if (it.isEmpty()) "" else "$it WIB" }, AppText.mono(11.sp, c.inkSoft))
            }
            VGap(6.dp)
            Txt(show.optString("title"), AppText.body(15.sp, c.ink, 700), maxLines = 2)
            val lineup = show.optJSONArray("lineup")?.rows().orEmpty()
            if (lineup.isNotEmpty()) {
                VGap(8.dp)
                AvatarStack(lineup.map { it.optString("img") })
            }
        }
    }
}

/** Status theater: live, tiket aktif, arsip, atau harga. */
@Composable
private fun ShowPill(show: JSONObject) {
    val c = LocalColors.current
    when {
        show.optBoolean("isLive") -> Pill("● Live", c.brand, Color.White)
        show.optBoolean("hasAccess") -> Pill("Tiket aktif", c.butter, c.butterInk)
        show.optString("source") == "archive" -> Pill("Arsip", c.surface, c.inkSoft)
        else -> Pill("Rp4.000", c.brand.copy(alpha = 0.12f), c.brand)
    }
}

/** Baris replay: foto, platform, nama, tanggal, durasi, penonton. */
@Composable
fun RecentTile(r: JSONObject, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val platform = r.optString("platform")
    Row(modifier.fillMaxWidth().pressable(onClick).glassCard(24.dp).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Picture(r.optString("avatar").ifEmpty { r.optString("image") }, Modifier.size(62.dp, 74.dp).clip(RoundedCornerShape(18.dp)), alignment = Alignment.TopCenter, fallback = r.optString("title"))
        Gap(14.dp)
        Column(Modifier.weight(1f)) {
            Micro(platformName(platform), color = if (platform == "idn") c.brand else c.inkSoft)
            VGap(4.dp)
            Txt(r.optString("title"), AppText.body(16.sp, c.ink, 800), maxLines = 1)
            VGap(2.dp)
            Txt(fmtWib(r.optString("start").ifEmpty { r.optString("date") }, "d MMM · HH.mm"), AppText.mono(11.sp, c.inkSoft))
        }
        Column(horizontalAlignment = Alignment.End) {
            if (r.optLong("durationMs") > 0) Txt(fmtDuration(r.optLong("durationMs")), AppText.display(22.sp, c.ink))
            if (r.optLong("viewers") > 0) {
                VGap(4.dp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(StreamIcons.Eye, null, Modifier.size(13.dp), colorFilter = ColorFilter.tint(c.inkSoft))
                    Gap(3.dp)
                    Txt(fmtCompact(r.optLong("viewers")), AppText.mono(11.sp, c.inkSoft))
                }
            }
        }
        Gap(6.dp)
    }
}

/** Kartu statistik kecil (label mikro + nilai); `accent` = merah. */
@Composable
fun StatBox(label: String, modifier: Modifier = Modifier, accent: Boolean = false, value: @Composable () -> Unit) {
    val c = LocalColors.current
    Column(
        modifier
            .then(if (accent) Modifier.clip(RoundedCornerShape(22.dp)).background(c.brandGradient) else Modifier.glassCard(22.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Txt(label.uppercase(), AppText.micro(if (accent) Color.White.copy(alpha = 0.7f) else c.inkSoft, 9.5.sp))
        VGap(4.dp)
        value()
    }
}

// ---------------------------------------------------------------- Live

@Composable
fun LiveScreen() {
    val nav = LocalNav.current
    val live = rememberFeed("live", nav.reload, pollMs = 15_000L) { "/live" }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    val list = live.rows.filter {
        when (filter) {
            1 -> it.optString("platform") == "idn"
            2 -> it.optString("platform") == "showroom"
            else -> true
        }
    }
    PullRefresh(onRefresh = { live.refresh() }) {
        LazyColumn(contentPadding = LocalInsets.current) {
            item { PageHeader("01", "Live", "IDN · Showroom · otomatis", "${live.rows.size}") }
            item {
                Segmented(listOf("Semua", "IDN Live", "Showroom"), filter, { filter = it })
                VGap(14.dp)
            }
            when {
                live.rows.isEmpty() && live.loading -> items(2) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 12.dp).fillMaxWidth().height(260.dp), 28.dp) }
                live.rows.isEmpty() && live.error.isNotEmpty() -> item { ErrorRetry(live.error, { nav.reload++ }) }
                list.isEmpty() -> item {
                    EmptyState(
                        StreamIcons.Live,
                        if (filter == 0) "Belum ada member yang live. Tarik ke bawah untuk memeriksa lagi." else "Tidak ada live di ${if (filter == 1) "IDN" else "Showroom"} saat ini.",
                    )
                }
                else -> itemsIndexed(list, key = { _, l -> l.optString("id") }) { i, l ->
                    LiveCard(l, Modifier.padding(16.dp, 0.dp, 16.dp, 12.dp).staggerIn(i)) { nav.push(Route.Watch(l)) }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Theater

@Composable
fun TheaterScreen() {
    val nav = LocalNav.current
    val catalog = rememberFeed("catalog", nav.reload) { "/catalog" }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    val list = if (filter == 1) catalog.rows.filter { it.optBoolean("hasAccess") } else catalog.rows
    PullRefresh(onRefresh = { catalog.refresh() }) {
        LazyColumn(contentPadding = LocalInsets.current) {
            item { PageHeader("02", "Theater", "Tiket Rp4.000 · atau Pass", if (catalog.rows.isNotEmpty()) "${catalog.rows.size}" else "") }
            item {
                Segmented(listOf("Jadwal", "Tiketku"), filter, { filter = it })
                VGap(14.dp)
            }
            when {
                catalog.rows.isEmpty() && catalog.loading -> items(4) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(96.dp), 24.dp) }
                catalog.rows.isEmpty() && catalog.error.isNotEmpty() -> item { ErrorRetry(catalog.error, { nav.reload++ }) }
                list.isEmpty() -> item {
                    EmptyState(
                        StreamIcons.Ticket,
                        if (filter == 1) "Belum ada tiket aktif. Beli tiket satu show atau pakai Stream Pass." else "Jadwal theater berikutnya akan muncul di sini.",
                        action = if (filter == 1) "Lihat Stream Pass" else "",
                        onAction = if (filter == 1) ({ nav.tab = 4 }) else null,
                    )
                }
                else -> itemsIndexed(list, key = { _, t -> t.optString("id") }) { i, t ->
                    ShowTile(t, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.Theater(t)) }
                }
            }
        }
    }
}

/** Grid lineup: foto bulat + nama depan, empat per baris; foto bisa dibuka layar penuh. */
@Composable
fun LineupGrid(lineup: List<JSONObject>, title: String, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    val nav = LocalNav.current
    Column(modifier.fillMaxWidth().glassCard(24.dp).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        lineup.chunked(4).forEachIndexed { row, chunk ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                chunk.forEachIndexed { col, m ->
                    val index = row * 4 + col
                    Column(
                        Modifier.weight(1f).staggerIn(index, 25).pressable({ nav.gallery(lineup.map { it.optString("img") }, index, title, "Lineup · ${m.optString("name")}") }),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Picture(m.optString("img"), Modifier.size(64.dp).clip(CircleShape), alignment = Alignment.TopCenter, fallback = m.optString("name"))
                        VGap(6.dp)
                        Txt(m.optString("name").substringBefore(' '), AppText.body(12.sp, c.ink, 700), maxLines = 1)
                    }
                }
                repeat(4 - chunk.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * Detail theater: poster (layar penuh saat diketuk), status, judul besar, tanggal, hitung mundur merah,
 * kartu aksi (tonton / beli tiket / Pass), dan lineup.
 */
@Composable
fun TheaterDetailScreen(show: JSONObject) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val date = show.optString("date")
    val live = show.optBoolean("isLive")
    val access = show.optBoolean("hasAccess")
    val archive = show.optString("source") == "archive"
    val lineup = show.optJSONArray("lineup")?.rows().orEmpty()
    val poster = show.optString("image")

    LazyColumn(contentPadding = detailPadding()) {
        item {
            Box(
                Modifier.fillMaxWidth().height(210.dp).clip(RoundedCornerShape(26.dp)).staggerIn(0)
                    .pressable({ nav.gallery(listOf(poster), 0, show.optString("title"), "Poster theater") }, 0.99f),
            ) {
                Picture(poster, Modifier.fillMaxSize())
                Box(Modifier.align(Alignment.TopStart).padding(12.dp)) { ShowPill(show) }
                if (poster.isNotEmpty()) ExpandBadge(Modifier.align(Alignment.BottomEnd).padding(12.dp))
            }
        }
        item {
            Column {
                VGap(18.dp)
                Micro(show.optString("subtitle").ifEmpty { "JKT48 Theater" }, Modifier.staggerIn(1), c.brand)
                VGap(6.dp)
                Txt(show.optString("title").uppercase(), AppText.display(34.sp, c.ink), Modifier.staggerIn(2))
                VGap(6.dp)
                Txt(fmtWib(date, "EEEE, d MMMM yyyy · HH.mm 'WIB'"), AppText.mono(12.sp, c.inkSoft), Modifier.staggerIn(3))
                if (!live && (parseInstant(date)?.toEpochMilli() ?: 0) > System.currentTimeMillis()) {
                    VGap(16.dp)
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(c.brandGradient).padding(18.dp).staggerIn(4), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Micro("Mulai dalam", color = Color.White.copy(alpha = 0.75f))
                            VGap(4.dp)
                            Countdown(date, AppText.display(30.sp, Color.White))
                        }
                        Image(StreamIcons.Timer, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.5f)))
                    }
                }
            }
        }
        item {
            VGap(16.dp)
            Column(Modifier.fillMaxWidth().glassCard(24.dp).padding(18.dp).staggerIn(5), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when {
                    archive -> {
                        Micro("Jadwal arsip")
                        Txt("Siaran langsung untuk jadwal ini belum tersedia. Jadwal tetap tampil supaya kamu tahu lineup-nya.", AppText.body(14.sp, c.ink, 500, 1.45f))
                    }
                    access && live -> {
                        Micro("Tiketmu aktif", color = c.brand)
                        Txt("Show sedang tayang. Tonton sambil ngobrol dengan penonton lain.", AppText.body(16.sp, c.ink, 700))
                        PrimaryButton("Tonton sekarang", icon = StreamIcons.Play) { nav.push(Route.Watch(show)) }
                    }
                    access -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RowIcon(StreamIcons.Check, Color(0xFF2FA35A))
                            Gap(12.dp)
                            Column {
                                Txt("Tiketmu aktif", AppText.body(16.sp, c.ink, 800))
                                Txt("Pemutar & obrolan terbuka saat show dimulai", AppText.mono(11.sp, c.inkSoft))
                            }
                        }
                    }
                    else -> {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Column(Modifier.weight(1f)) {
                                Micro("Tiket satu show")
                                VGap(2.dp)
                                Txt("Rp4.000", AppText.display(34.sp, c.ink))
                            }
                            Txt("QRIS · semua e-wallet", AppText.mono(11.sp, c.inkSoft), Modifier.padding(bottom = 6.dp))
                        }
                        PrimaryButton(if (busy) "Membuat tagihan…" else "Beli tiket", icon = StreamIcons.Ticket) {
                            if (busy) return@PrimaryButton
                            busy = true
                            error = ""
                            scope.launch {
                                runCatching { nav.checkout("show", show.optString("id")) }
                                    .onSuccess { nav.push(Route.Pay(it)) }
                                    .onFailure { error = it.message.orEmpty() }
                                busy = false
                            }
                        }
                        GlassButton("Pakai Stream Pass", Modifier.fillMaxWidth(), StreamIcons.Pass, c.brand) { nav.tab = 4 }
                    }
                }
                if (error.isNotEmpty()) Txt(error, AppText.body(13.sp, c.brand))
            }
        }
        if (lineup.isNotEmpty()) item {
            VGap(22.dp)
            Micro("Lineup · ${lineup.size} member", color = c.brand)
            VGap(10.dp)
            LineupGrid(lineup, show.optString("title"))
        }
    }
}

/** Lencana kecil "perbesar" di pojok gambar yang bisa dibuka layar penuh. */
@Composable
fun ExpandBadge(modifier: Modifier = Modifier) {
    Box(modifier.size(32.dp).background(Color.Black.copy(alpha = 0.45f), CircleShape), contentAlignment = Alignment.Center) {
        Image(StreamIcons.Expand, "Layar penuh", Modifier.size(16.dp), colorFilter = ColorFilter.tint(Color.White))
    }
}

// ---------------------------------------------------------------- Replay

@Composable
fun ReplayScreen() {
    val nav = LocalNav.current
    val recent = rememberFeed("recent", nav.reload, paged = true) { "/recent?page=$it" }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    val list = recent.rows.filter {
        when (filter) {
            1 -> it.optString("platform") == "idn"
            2 -> it.optString("platform") == "showroom"
            else -> true
        }
    }
    val state = rememberLazyListState()
    LoadMoreOnEnd(state, recent)
    PullRefresh(onRefresh = { recent.refresh() }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { PageHeader("03", "Replay", "Tanpa tunggu 72 jam") }
            item {
                Segmented(listOf("Semua", "IDN Live", "Showroom"), filter, { filter = it })
                VGap(14.dp)
            }
            when {
                recent.rows.isEmpty() && recent.loading -> items(5) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(94.dp)) }
                recent.rows.isEmpty() && recent.error.isNotEmpty() -> item { ErrorRetry(recent.error, { nav.reload++ }) }
                list.isEmpty() -> item { EmptyState(StreamIcons.Replay, "Belum ada replay di sini. Gulir untuk memuat lebih banyak.") }
                else -> itemsIndexed(list, key = { _, r -> r.optString("id") }) { i, r ->
                    RecentTile(r, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i % 12)) { nav.push(Route.Recent(r)) }
                }
            }
            if (!recent.end && recent.rows.isNotEmpty()) item { Loading() }
        }
    }
}

/**
 * Detail replay (setara 2.6.1): foto & nama, empat statistik yang menghitung naik, pemutar replay di dalam
 * halaman (bisa layar penuh, pilihan bagian), top supporter, gift, dan cuplikan layar (layar penuh, geser, zoom).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecentDetailScreen(item: JSONObject) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val id = item.optString("id")
    val doc = rememberDoc("/recent/${Uri.encode(id)}", nav.reload)
    val d = doc.data ?: item
    val platform = d.optString("platform")
    val photo = d.optString("avatar").ifEmpty { d.optString("image") }
    val title = "${d.optString("title")} · ${fmtWib(d.optString("start").ifEmpty { d.optString("date") }, "d MMM yyyy")}"
    val shots = d.optJSONArray("screenshots")?.let { a -> (0 until a.length()).map { a.optString(it) } }.orEmpty().filter { it.isNotEmpty() }
    val fans = d.optJSONArray("fans")?.rows().orEmpty()
    val gifts = d.optJSONArray("gifts")?.rows().orEmpty()

    LazyColumn(contentPadding = detailPadding()) {
        item {
            Row(Modifier.staggerIn(0), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(88.dp, 106.dp).clip(RoundedCornerShape(22.dp)).pressable({ nav.gallery(listOfNotNull(photo.ifEmpty { null }, d.optString("image").takeIf { it.isNotEmpty() && it != photo }), 0, d.optString("title"), "Foto member") })) {
                    Picture(photo, Modifier.fillMaxSize(), alignment = Alignment.TopCenter, fallback = d.optString("title"))
                }
                Gap(16.dp)
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(7.dp).background(c.brand, CircleShape))
                        Gap(6.dp)
                        Micro("Replay · ${platformName(platform)}", color = c.brand)
                    }
                    VGap(6.dp)
                    Txt(d.optString("title").uppercase(), AppText.display(34.sp, c.ink), maxLines = 1)
                    VGap(4.dp)
                    Txt(fmtWib(d.optString("start").ifEmpty { d.optString("date") }, "EEEE, d MMM yyyy · HH.mm"), AppText.mono(11.5.sp, c.inkSoft))
                }
            }
            VGap(16.dp)
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox("Durasi", Modifier.weight(1f).height(78.dp).staggerIn(1), accent = true) {
                        Txt(if (d.optLong("durationMs") > 0) fmtDuration(d.optLong("durationMs")) else "–", AppText.display(30.sp, Color.White))
                    }
                    StatBox("Penonton", Modifier.weight(1f).height(78.dp).staggerIn(2)) { CountUp(d.optLong("viewers"), AppText.display(30.sp, c.ink)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatBox(d.optString("pointLabel").ifEmpty { if (platform == "idn") "Gold" else "Poin" }, Modifier.weight(1f).height(78.dp).staggerIn(3)) {
                        CountUp(if (d.has("points")) d.optLong("points") else null, AppText.display(30.sp, c.ink))
                    }
                    StatBox("Komentar", Modifier.weight(1f).height(78.dp).staggerIn(4)) { CountUp(if (d.has("comments")) d.optLong("comments") else null, AppText.display(30.sp, c.ink)) }
                }
            }
            VGap(18.dp)
        }
        item { ReplayPanel(d) }
        if (doc.data == null && doc.error.isEmpty()) item {
            VGap(18.dp)
            Skeleton(Modifier.fillMaxWidth().height(220.dp), 26.dp)
        }
        if (doc.data == null && doc.error.isNotEmpty()) item { ErrorRetry(doc.error, { nav.reload++ }) }
        if (fans.isNotEmpty()) item {
            VGap(26.dp)
            Micro("Top supporter · ${fans.size}", color = c.brand)
            VGap(10.dp)
            Column(Modifier.fillMaxWidth().glassCard(24.dp).padding(horizontal = 12.dp, vertical = 6.dp)) {
                fans.take(10).forEachIndexed { i, f ->
                    if (i > 0) Box(Modifier.fillMaxWidth().height(0.8.dp).background(c.line))
                    Row(Modifier.padding(vertical = 8.dp).staggerIn(i, 30), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(26.dp).clip(CircleShape).then(if (i < 3) Modifier.background(c.brandGradient) else Modifier), contentAlignment = Alignment.Center) {
                            Txt("${i + 1}", AppText.mono(11.5.sp, if (i < 3) Color.White else c.inkSoft, FontWeight.SemiBold))
                        }
                        Gap(10.dp)
                        Picture(f.optString("avatar"), Modifier.size(34.dp).clip(CircleShape), fallback = f.optString("name"))
                        Gap(10.dp)
                        Txt(f.optString("name"), AppText.body(14.sp, c.ink, 700), Modifier.weight(1f), maxLines = 1)
                        if (f.optLong("amount") > 0) Txt(fmtCompact(f.optLong("amount")), AppText.mono(12.5.sp, if (i < 3) c.brand else c.ink, FontWeight.SemiBold))
                    }
                }
            }
        }
        if (gifts.isNotEmpty()) item {
            VGap(26.dp)
            Micro(if (d.optBoolean("giftsPartial")) "Gift · data parsial" else "Gift · ${gifts.size} jenis", color = c.brand)
            VGap(10.dp)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                gifts.take(24).forEach { g ->
                    Row(Modifier.glassCard(99.dp).padding(6.dp, 6.dp, 12.dp, 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (g.optString("img").isEmpty()) Image(StreamIcons.Gift, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.brand))
                        else Picture(g.optString("img"), Modifier.size(26.dp).background(Color.Transparent), contentScale = ContentScale.Fit)
                        Gap(6.dp)
                        Txt("${g.optString("name")} ×${fmtCompact(g.optLong("num"))}", AppText.body(12.5.sp, c.ink, 700))
                        if (g.optLong("users") > 0) Txt(" · ${g.optLong("users")} org", AppText.body(11.5.sp, c.inkSoft))
                    }
                }
            }
        }
        if (shots.isNotEmpty()) item {
            VGap(26.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Micro("Cuplikan · ${shots.size}", Modifier.weight(1f), c.brand)
                Txt("Ketuk untuk layar penuh", AppText.mono(10.5.sp, c.inkSoft))
            }
            VGap(10.dp)
            // 9 petak; petak terakhir menunjukkan sisa cuplikan (+N), semuanya bisa digeser di penampil.
            val visible = shots.take(9)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                visible.chunked(3).forEachIndexed { row, chunk ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        chunk.forEachIndexed { col, url ->
                            val i = row * 3 + col
                            val more = if (i == visible.lastIndex) shots.size - visible.size else 0
                            Box(Modifier.weight(1f).aspectRatio(0.75f).clip(RoundedCornerShape(14.dp)).pressable({ nav.gallery(shots, i, title, "Cuplikan layar live") }).staggerIn(i, 25)) {
                                Picture(url, Modifier.fillMaxSize())
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

/**
 * Panel replay di dalam halaman (pola 2.6.1): panel tinta dengan label REPLAY dan pilihan bagian.
 * Sumber diminta saat tombol putar ditekan; pemutar punya tombol layar penuh.
 */
@Composable
private fun ReplayPanel(d: JSONObject) {
    val c = LocalColors.current
    val id = d.optString("id")
    val scope = rememberCoroutineScope()
    var data by remember(id) { mutableStateOf<JSONObject?>(null) }
    var busy by remember(id) { mutableStateOf(false) }
    var error by remember(id) { mutableStateOf("") }
    var part by remember(id) { mutableIntStateOf(0) }
    fun load() {
        if (busy) return
        busy = true
        error = ""
        scope.launch {
            runCatching { StreamApi.request("/playback/recent/${Uri.encode(id)}", "POST") }
                .onSuccess { data = it }
                .onFailure { error = it.message.orEmpty() }
            busy = false
        }
    }
    val parts = data?.optJSONArray("items")?.rows().orEmpty()
    val count = maxOf(parts.size, d.optInt("recordingCount"))
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.panel).padding(10.dp).staggerIn(5)) {
        Row(Modifier.padding(8.dp, 4.dp, 8.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Image(StreamIcons.Play, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
            Gap(6.dp)
            Txt(if (count > 1) "REPLAY · $count BAGIAN" else "REPLAY", AppText.micro(Color.White.copy(alpha = 0.6f)), Modifier.weight(1f))
            if (parts.size > 1) parts.indices.forEach { i ->
                Box(
                    Modifier.padding(start = 6.dp).height(30.dp).clip(CircleShape)
                        .background(if (i == part) c.brandGradient else Brush.linearGradient(listOf(Color.White.copy(alpha = 0.12f), Color.White.copy(alpha = 0.12f))))
                        .pressable({ part = i })
                        .padding(horizontal = 10.dp),
                    contentAlignment = Alignment.Center,
                ) { Txt("Bagian ${i + 1}", AppText.body(11.sp, Color.White, 700)) }
            }
        }
        val current = parts.getOrNull(part)
        if (current != null) {
            key(current.optString("url")) {
                MediaPlayer(
                    MediaSource(current.optString("url"), current.optBoolean("hls")),
                    title = if (parts.size > 1) "${d.optString("title")} · Bagian ${part + 1}" else d.optString("title"),
                    label = "Replay · ${platformName(d.optString("platform"))}",
                    poster = d.optString("image"),
                    onFatal = { data = null },
                )
            }
        } else {
            Box(
                Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(22.dp)).background(Color.Black).pressable({ load() }, 0.99f),
                contentAlignment = Alignment.Center,
            ) {
                Picture(d.optString("image").ifEmpty { d.optString("avatar") }, Modifier.fillMaxSize().graphicsLayer { alpha = 0.45f })
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (busy) Spinner(26.dp, Color.White)
                    else Box(Modifier.size(64.dp).background(Color.White.copy(alpha = 0.92f), CircleShape), contentAlignment = Alignment.Center) {
                        Image(StreamIcons.Play, "Putar replay", Modifier.size(30.dp), colorFilter = ColorFilter.tint(Color.Black))
                    }
                    VGap(10.dp)
                    Txt(if (error.isNotEmpty()) error else if (busy) "Menyiapkan replay…" else "Putar replay · bisa layar penuh", AppText.body(13.sp, Color.White.copy(alpha = 0.85f), 600))
                }
            }
        }
    }
}
