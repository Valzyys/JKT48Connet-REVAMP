package app.jkt48connect.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Cake
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.SmartDisplay
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.BirthdayEntry
import app.jkt48connect.core.Favorites
import app.jkt48connect.core.LiveSession
import app.jkt48connect.core.TheaterShow
import app.jkt48connect.core.Video
import app.jkt48connect.core.daysUntil
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.fmtDuration
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.fmtWib
import app.jkt48connect.core.nowWib
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.AvatarStack
import app.jkt48connect.ui.components.BirthdayBubble
import app.jkt48connect.ui.components.Countdown
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.GroupDivider
import app.jkt48connect.ui.components.GroupRow
import app.jkt48connect.ui.components.InsetGroup
import app.jkt48connect.ui.components.LiveCard
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.PhotoScrim
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.PullRefresh
import app.jkt48connect.ui.components.SectionHead
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Beranda ala aplikasi iPhone: judul besar dengan tanggal, empat widget (live, show berikutnya, ulang tahun,
 * video baru), pintasan kaca, lalu bagian-bagian berisi kartu dan daftar inset.
 */
@Composable
fun HomeScreen() {
    val nav = LocalNav.current
    val c = LocalColors.current
    val live = rememberLoad { Api.live(it) }
    val next = rememberLoad { Api.nextSchedule(it) }
    val recent = rememberLoad { Api.recent(1, it) }
    val birthdays = rememberLoad { Api.birthdays(it) }
    val news = rememberLoad { Api.news(1, it) }
    val videos = rememberLoad { Api.videos(it) }
    val posts = rememberLoad { latestPosts(it) }
    val photos = rememberLoad { Api.members(it) }.data?.associate { it.id to it.img }.orEmpty()
    val state = rememberLazyListState()

    PullRefresh(onRefresh = {
        coroutineScope {
            listOf(
                async { live.refresh() }, async { next.refresh() }, async { recent.refresh() }, async { videos.refresh() }, async { posts.refresh() },
            ).forEach { it.await() }
        }
    }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { LargeTitle() }
            item {
                val show = next.data?.let { s -> s.firstOrNull { it.category == "show" } ?: s.firstOrNull() }
                val bday = birthdays.data?.minByOrNull { daysUntil(it.birthdate) }
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LiveWidget(live.data, Modifier.weight(1f).staggerIn(1)) { nav.tab = 1 }
                        ShowWidget(show, Modifier.weight(1f).staggerIn(2)) { show?.let { nav.push(Route.Theater(it.id, it.title)) } ?: run { nav.tab = 2 } }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        BirthdayWidget(bday, Modifier.weight(1f).staggerIn(3)) { bday?.let { nav.push(Route.Member(it.id, it.name, it.img)) } ?: nav.push(Route.Birthday) }
                        val v = videos.data?.firstOrNull()
                        VideoWidget(v, Modifier.weight(1f).staggerIn(4)) { v?.let { nav.push(Route.VideoDetail(it)) } ?: nav.push(Route.Videos) }
                    }
                }
            }
            item { QuickActions() }
            if (Favorites.all.isNotEmpty()) {
                item { SectionHead("Member favoritmu", "Oshi kamu") { nav.tab = 4 } }
                item {
                    val liveNames = live.data.orEmpty().map { it.name.lowercase() }
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        itemsIndexed(Favorites.all, key = { _, f -> f.id }) { i, f ->
                            val isLive = liveNames.any { it == f.name.lowercase() || it.startsWith(f.name.lowercase() + " ") }
                            FavoriteBubble(f, isLive, Modifier.staggerIn(i, 40)) { nav.push(Route.Member(f.id, f.name, f.img)) }
                        }
                    }
                }
            }
            item { SectionHead("IDN Live & Showroom", "Live sekarang") { nav.tab = 1 } }
            item {
                val list = live.data
                when {
                    live.error != null && list == null -> ErrorRetry(live.error!!, { live.run(true) })
                    list == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(240.dp), 26.dp)
                    list.isEmpty() -> EmptyLive()
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(list) { i, l -> LiveCard(l, Modifier.fillParentMaxWidth(0.84f).staggerIn(i), 240.dp) }
                    }
                }
            }
            item { SectionHead("YouTube JKT48 & JKT48 TV", "Video terbaru") { nav.push(Route.Videos) } }
            item {
                val list = videos.data
                when {
                    videos.error != null && list == null -> ErrorRetry(videos.error!!, { videos.run(true) })
                    list == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(210.dp), 22.dp)
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(list.take(8), key = { _, v -> v.id }) { i, v ->
                            VideoCard(v, Modifier.fillParentMaxWidth(0.72f).staggerIn(i), compact = true) { nav.push(Route.VideoDetail(v)) }
                        }
                    }
                }
            }
            item { SectionHead("X, TikTok & Instagram", "Dari member") { nav.push(Route.Social()) } }
            item {
                val list = posts.data
                when {
                    list == null && posts.error == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(260.dp), 22.dp)
                    list.isNullOrEmpty() -> Txt("Belum ada posting terbaru.", AppText.body(14.sp, c.inkSoft), Modifier.padding(horizontal = 20.dp))
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(list, key = { _, p -> "${p.platform}${p.id}" }) { i, p ->
                            MiniPost(p, photos[p.memberId].orEmpty(), Modifier.staggerIn(i)) { nav.push(Route.Post(p)) }
                        }
                    }
                }
            }
            item { SectionHead("Rekap live terbaru", "Recent") { nav.tab = 3 } }
            item {
                val list = recent.data?.items?.take(5)
                if (list == null) Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(300.dp), 20.dp)
                else InsetGroup(Modifier.staggerIn(0)) {
                    list.forEachIndexed { i, r ->
                        if (i > 0) GroupDivider(72.dp)
                        GroupRow(
                            title = r.name,
                            subtitle = "${r.platformLabel} · ${fmtDate(r.start, "d MMM")} · ${fmtTime(r.start)}",
                            leading = { NetImage(r.img, Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)), fallback = r.name) },
                            trailing = { Txt(fmtDuration(r.durationMs), AppText.body(14.sp, c.inkSoft, 700)) },
                            onClick = { nav.push(Route.Recent(r)) },
                        )
                    }
                }
            }
            item { SectionHead("Rayakan bersama", "Ulang tahun") { nav.push(Route.Birthday) } }
            item {
                val list = birthdays.data
                if (list == null) Spacer(Modifier.height(120.dp)) else LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    itemsIndexed(list) { i, b -> Box(Modifier.staggerIn(i)) { BirthdayBubble(b) { nav.push(Route.Member(b.id, b.name, b.img)) } } }
                }
            }
            item { SectionHead("Dari jkt48.com", "Berita") { nav.push(Route.News) } }
            news.data?.items?.take(4)?.let { list ->
                item {
                    InsetGroup {
                        list.forEachIndexed { i, n ->
                            if (i > 0) GroupDivider()
                            GroupRow(title = n.title, subtitle = "${n.category} · ${fmtDate(n.date, "d MMMM yyyy")}", onClick = { nav.push(Route.NewsDetail(n)) })
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

/** Judul besar ala iOS: tanggal kecil di atas, sapaan sesuai jam WIB. */
@Composable
private fun LargeTitle() {
    val c = LocalColors.current
    val hour = nowWib().hour
    val greet = when {
        hour < 11 -> "Selamat pagi"
        hour < 15 -> "Selamat siang"
        hour < 18 -> "Selamat sore"
        else -> "Selamat malam"
    }
    Column(Modifier.padding(20.dp, 4.dp, 20.dp, 16.dp).staggerIn(0)) {
        Txt(fmtWib(nowWib(), "EEEE, d MMMM").uppercase(), AppText.body(12.5.sp, c.brand, 800).copy(letterSpacing = androidx.compose.ui.unit.TextUnit(0.6f, androidx.compose.ui.unit.TextUnitType.Sp)))
        Txt(greet, AppText.title(34.sp, c.ink))
    }
}

/** Kerangka widget persegi bersudut membulat (seperti widget kecil di layar utama iPhone). */
@Composable
private fun Widget(modifier: Modifier, onClick: () -> Unit, background: Modifier, content: @Composable () -> Unit) {
    Box(modifier.aspectRatio(1f).pressable(onClick).clip(RoundedCornerShape(24.dp)).then(background)) { content() }
}

@Composable
private fun WidgetLabel(text: String, color: Color) {
    Txt(text.uppercase(), AppText.body(11.sp, color, 800).copy(letterSpacing = androidx.compose.ui.unit.TextUnit(0.5f, androidx.compose.ui.unit.TextUnitType.Sp)), maxLines = 1)
}

/** Widget live: merah bila ada yang live (angka besar + foto), kartu biasa bila belum. */
@Composable
private fun LiveWidget(list: List<LiveSession>?, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val n = list?.size
    val on = (n ?: 0) > 0
    Widget(modifier, onClick, if (on) Modifier.background(c.brandGradient) else Modifier.appCard(24.dp)) {
        Column(Modifier.fillMaxSize().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SignalBars(color = if (on) Color.White else c.inkSoft, height = 12.dp, active = on)
                Spacer(Modifier.width(6.dp))
                WidgetLabel("Live", if (on) Color.White.copy(alpha = 0.85f) else c.inkSoft)
            }
            Spacer(Modifier.weight(1f))
            Txt(n?.toString() ?: "–", AppText.display(56.sp, if (on) Color.White else c.ink))
            Txt(if (on) "member sedang live" else "Belum ada yang live", AppText.body(12.5.sp, if (on) Color.White.copy(alpha = 0.85f) else c.inkSoft, 700), maxLines = 1)
            if (on) {
                VGap(8.dp)
                AvatarStack(list.orEmpty().map { it.img.ifEmpty { it.avatar } }, 22.dp, 4, ring = Color(0xFFC3142B), extraColor = Color.White)
            }
        }
    }
}

/** Widget show berikutnya: panel gelap, judul, dan hitung mundur. */
@Composable
private fun ShowWidget(show: TheaterShow?, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Widget(modifier, onClick, Modifier.background(c.panel).then(if (c.dark) Modifier.appCard(24.dp) else Modifier)) {
        Column(Modifier.fillMaxSize().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.Timer, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(c.brand))
                Spacer(Modifier.width(5.dp))
                WidgetLabel("Show berikutnya", Color.White.copy(alpha = 0.6f))
            }
            Spacer(Modifier.weight(1f))
            if (show == null) Skeleton(Modifier.fillMaxWidth().height(40.dp), 10.dp) else {
                Txt(show.title, AppText.body(17.sp, Color.White, 800, 1.2f), maxLines = 2)
                VGap(4.dp)
                Txt("${fmtDate(show.date, "EEE, d MMM")} · ${fmtTime(show.date)}", AppText.body(11.5.sp, Color.White.copy(alpha = 0.6f), 600), maxLines = 1)
                VGap(8.dp)
                Box(Modifier.background(c.brandGradient, CircleShape).padding(horizontal = 10.dp, vertical = 5.dp)) {
                    Countdown(show.date, AppText.mono(12.sp, Color.White, FontWeight.SemiBold))
                }
            }
        }
    }
}

/** Widget ulang tahun: foto penuh, nama, dan sisa hari. */
@Composable
private fun BirthdayWidget(b: BirthdayEntry?, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Widget(modifier, onClick, Modifier.background(c.surface)) {
        if (b != null) {
            NetImage(b.img, Modifier.fillMaxSize(), fallback = b.name)
            Box(Modifier.fillMaxSize().background(PhotoScrim))
        }
        Column(Modifier.fillMaxSize().padding(14.dp)) {
            Row(Modifier.background(Color.Black.copy(alpha = 0.35f), CircleShape).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.Cake, null, Modifier.size(13.dp), colorFilter = ColorFilter.tint(Color.White))
                Spacer(Modifier.width(4.dp))
                WidgetLabel("Ulang tahun", Color.White)
            }
            Spacer(Modifier.weight(1f))
            if (b != null) {
                val d = daysUntil(b.birthdate)
                Txt(b.name.substringBefore(' '), AppText.body(18.sp, Color.White, 800), maxLines = 1)
                Txt(if (d == 0) "Hari ini 🎉" else "$d hari lagi · ${fmtDate(b.birthdate, "d MMM")}", AppText.body(12.sp, Color.White.copy(alpha = 0.85f), 700), maxLines = 1)
            }
        }
    }
}

/** Widget video baru: sampul penuh dengan tombol putar. */
@Composable
private fun VideoWidget(v: Video?, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Widget(modifier, onClick, Modifier.background(c.surface)) {
        if (v != null) {
            NetImage(v.thumbnail, Modifier.fillMaxSize(), alignment = Alignment.Center)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.25f to Color.Black.copy(alpha = 0.15f), 1f to Color.Black.copy(alpha = 0.8f))))
        }
        Column(Modifier.fillMaxSize().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(22.dp).background(c.brand, CircleShape), contentAlignment = Alignment.Center) {
                    Image(Icons.Rounded.PlayArrow, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(Color.White))
                }
                Spacer(Modifier.width(6.dp))
                WidgetLabel("Video baru", Color.White)
            }
            Spacer(Modifier.weight(1f))
            if (v != null) Txt(v.title, AppText.body(13.5.sp, Color.White, 800, 1.25f), maxLines = 3)
        }
    }
}

/** Pintasan kaca: tiap tombol bisa ditekan & ditarik, kacanya membal. */
@Composable
private fun QuickActions() {
    val c = LocalColors.current
    val nav = LocalNav.current
    val items = listOf(
        Triple(Icons.Rounded.SmartDisplay, "Video") { nav.push(Route.Videos) },
        Triple(Icons.Rounded.Forum, "Sosmed") { nav.push(Route.Social()) },
        Triple(Icons.Rounded.Cake, "Ultah") { nav.push(Route.Birthday) },
        Triple(Icons.Rounded.Newspaper, "Berita") { nav.push(Route.News) },
    )
    Row(Modifier.padding(16.dp, 14.dp, 16.dp, 0.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items.forEachIndexed { i, (icon, label, onClick) ->
            LiquidButton(
                onClick = onClick,
                modifier = Modifier.weight(1f).height(70.dp).staggerIn(i + 5, 50),
                shape = RoundedRectangle(20.dp),
                contentPadding = PaddingValues(0.dp),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Image(icon, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.brand))
                    VGap(5.dp)
                    Txt(label, AppText.body(12.sp, c.ink, 800))
                }
            }
        }
    }
}

@Composable
private fun EmptyLive() {
    val c = LocalColors.current
    Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth().appCard(20.dp).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).background(c.bg, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            SignalBars(color = c.inkSoft, height = 18.dp, active = false)
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Txt("Belum ada yang live", AppText.body(15.sp, c.ink, 800))
            VGap(2.dp)
            Txt("Cek lagi sebentar ya!", AppText.body(13.sp, c.inkSoft))
        }
    }
}

/** Avatar oshi di beranda; cincin merah + label LIVE bila sedang live. */
@Composable
private fun FavoriteBubble(f: Favorites.Fav, live: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Column(modifier.width(72.dp).pressable(onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.BottomCenter) {
            Box(
                Modifier.size(70.dp).background(if (live) c.brandGradient else Brush.linearGradient(listOf(c.line, c.line)), CircleShape).padding(3.dp)
                    .background(c.bg, CircleShape).padding(2.dp),
            ) {
                NetImage(f.img, Modifier.fillMaxSize().clip(CircleShape), fallback = f.name)
            }
            if (live) {
                Txt("LIVE", AppText.micro(Color.White, 8.5.sp), Modifier.offset(y = 6.dp).background(c.brandGradient, RoundedCornerShape(50)).padding(horizontal = 7.dp, vertical = 2.dp))
            }
        }
        VGap(10.dp)
        Txt(f.name, AppText.body(12.sp, c.ink, 700), maxLines = 1)
    }
}
