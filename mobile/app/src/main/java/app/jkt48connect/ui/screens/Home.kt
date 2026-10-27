package app.jkt48connect.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Cake
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.SmartDisplay
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.Favorites
import app.jkt48connect.core.LiveSession
import app.jkt48connect.core.TheaterShow
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
import app.jkt48connect.ui.components.PageHeader
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.PullRefresh
import app.jkt48connect.ui.components.SectionHead
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
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
 * Beranda: satu kartu status merah (siapa yang live + show berikutnya), pintasan kaca, lalu bagian-bagian
 * yang hanya tampil bila ada isinya: oshi, live, video, posting member, recent, ulang tahun, berita.
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
    val state = rememberLazyListState()

    PullRefresh(onRefresh = {
        coroutineScope {
            listOf(
                async { live.refresh() }, async { next.refresh() }, async { recent.refresh() }, async { videos.refresh() },
            ).forEach { it.await() }
        }
    }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { PageHeader("", "JKT48Connect") }
            item {
                val show = next.data?.let { s -> s.firstOrNull { it.category == "show" } ?: s.firstOrNull() }
                StatusCard(
                    live = live.data,
                    show = show,
                    onLive = { nav.tab = 1 },
                    onShow = { show?.let { nav.push(Route.Theater(it.id, it.title)) } ?: run { nav.tab = 2 } },
                )
            }
            item { QuickActions() }

            if (Favorites.all.isNotEmpty()) {
                item { SectionHead("Oshi kamu", "Favoritmu") { nav.tab = 4 } }
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

            // Live: kartu besar hanya bila ada yang live (status "belum ada" sudah tampil di kartu atas).
            val liveList = live.data
            if (!liveList.isNullOrEmpty()) {
                item { SectionHead("IDN Live · Showroom", "Live sekarang") { nav.tab = 1 } }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(liveList) { i, l -> LiveCard(l, Modifier.fillParentMaxWidth(0.84f).staggerIn(i), 250.dp) }
                    }
                }
            }

            item { SectionHead("YouTube JKT48 · JKT48 TV", "Video terbaru") { nav.push(Route.Videos) } }
            item {
                val list = videos.data
                when {
                    videos.error != null && list == null -> ErrorRetry(videos.error!!, { videos.run(true) })
                    list == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(210.dp), 22.dp)
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(list.take(8), key = { _, v -> v.id }) { i, v ->
                            VideoCard(v, Modifier.fillParentMaxWidth(0.74f).staggerIn(i), compact = true) { nav.push(Route.VideoDetail(v)) }
                        }
                    }
                }
            }

            item { SectionHead("Gift · supporter · replay", "Recent") { nav.tab = 3 } }
            item {
                val list = recent.data?.items?.take(5)
                if (list == null) Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(300.dp), 22.dp)
                else InsetGroup {
                    list.forEachIndexed { i, r ->
                        if (i > 0) GroupDivider(76.dp)
                        GroupRow(
                            title = r.name,
                            subtitle = "${r.platformLabel} · ${fmtDate(r.start, "d MMM")} · ${fmtTime(r.start)}",
                            leading = { NetImage(r.img, Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)), fallback = r.name) },
                            trailing = { Txt(fmtDuration(r.durationMs), AppText.display(20.sp, c.ink)) },
                            onClick = { nav.push(Route.Recent(r)) },
                        )
                    }
                }
            }

            val bdays = birthdays.data
            if (!bdays.isNullOrEmpty()) {
                item { SectionHead("Rayakan bersama", "Ulang tahun") { nav.push(Route.Birthday) } }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        itemsIndexed(bdays) { i, b -> Box(Modifier.staggerIn(i)) { BirthdayBubble(b) { nav.push(Route.Member(b.id, b.name, b.img)) } } }
                    }
                }
            }

            news.data?.items?.take(4)?.takeIf { it.isNotEmpty() }?.let { list ->
                item { SectionHead("Dari jkt48.com", "Berita") { nav.push(Route.News) } }
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

/**
 * Kartu status merah di atas beranda: sapaan & tanggal, berapa member yang sedang live (foto + tombol tonton),
 * lalu show berikutnya dengan hitung mundur. Bagian atas membuka tab Live, bagian bawah membuka detail show.
 */
@Composable
private fun StatusCard(live: List<LiveSession>?, show: TheaterShow?, onLive: () -> Unit, onShow: () -> Unit) {
    val c = LocalColors.current
    val hour = nowWib().hour
    val greet = when {
        hour < 11 -> "Selamat pagi"
        hour < 15 -> "Selamat siang"
        hour < 18 -> "Selamat sore"
        else -> "Selamat malam"
    }
    val n = live?.size ?: 0
    val white70 = Color.White.copy(alpha = 0.7f)
    Box(
        Modifier
            .padding(16.dp, 6.dp, 16.dp, 0.dp)
            .shadow(24.dp, RoundedCornerShape(30.dp), ambientColor = c.brand, spotColor = c.brand)
            .clip(RoundedCornerShape(30.dp))
            .background(c.brandGradient)
            .fillMaxWidth()
            .staggerIn(0),
    ) {
        // Logo besar samar di pojok (diam, tanpa animasi supaya ringan).
        PixelLogo(190.dp, Modifier.align(Alignment.TopEnd).offset(54.dp, (-36).dp).graphicsLayer { rotationZ = 18f; alpha = 0.13f }, color = Color.White)
        Column {
            Column(Modifier.fillMaxWidth().pressable(onLive, 0.99f).padding(20.dp, 18.dp, 20.dp, 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PixelLogo(20.dp, color = Color.White)
                    Spacer(Modifier.width(10.dp))
                    Txt("$greet · ${fmtWib(nowWib(), "EEE, d MMM")}".uppercase(), AppText.micro(Color.White.copy(alpha = 0.8f), 10.sp), Modifier.weight(1f), maxLines = 1)
                    SignalBars(color = Color.White, height = 12.dp, active = n > 0)
                }
                VGap(20.dp)
                if (live == null) {
                    Box(Modifier.size(180.dp, 84.dp).background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(14.dp)))
                } else if (n > 0) {
                    Txt("$n MEMBER", AppText.display(44.sp, Color.White))
                    Txt("SEDANG LIVE", AppText.display(44.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
                    VGap(14.dp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AvatarStack(live.map { it.img.ifEmpty { it.avatar } }, 30.dp, 5, ring = Color(0xFFD01B33), extraColor = Color.White)
                        Spacer(Modifier.weight(1f))
                        Row(Modifier.background(Color.White, CircleShape).padding(14.dp, 8.dp, 10.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Txt("Tonton", AppText.body(13.sp, c.brand, 800))
                            Spacer(Modifier.width(4.dp))
                            Image(Icons.AutoMirrored.Rounded.ArrowForward, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(c.brand))
                        }
                    }
                } else {
                    Txt("BELUM ADA", AppText.display(44.sp, Color.White))
                    Txt("YANG LIVE", AppText.display(44.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
                    VGap(8.dp)
                    Txt("Kamu dapat notifikasi begitu ada member yang mulai live.", AppText.body(13.5.sp, Color.White.copy(alpha = 0.82f)))
                }
            }
            Box(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.22f)))
            Row(Modifier.fillMaxWidth().pressable(onShow, 0.99f).padding(20.dp, 14.dp, 16.dp, 18.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Txt("SHOW BERIKUTNYA", AppText.micro(white70, 9.5.sp))
                    VGap(4.dp)
                    if (show == null) Box(Modifier.size(150.dp, 18.dp).background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(6.dp)))
                    else {
                        Txt(show.title, AppText.body(17.sp, Color.White, 800), maxLines = 1)
                        Txt("${fmtDate(show.date, "EEE, d MMM")} · ${fmtTime(show.date)}", AppText.mono(11.sp, white70), maxLines = 1)
                    }
                }
                if (show != null) {
                    Spacer(Modifier.width(10.dp))
                    Row(Modifier.background(Color.Black.copy(alpha = 0.22f), CircleShape).padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Image(Icons.Rounded.Timer, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(Color.White))
                        Spacer(Modifier.width(5.dp))
                        Countdown(show.date, AppText.mono(12.sp, Color.White, FontWeight.SemiBold))
                    }
                }
            }
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
                modifier = Modifier.weight(1f).height(72.dp).staggerIn(i + 1, 50),
                shape = RoundedRectangle(22.dp),
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
