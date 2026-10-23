package app.jkt48connect.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.TheaterShow
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.nowWib
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.ArrowCircle
import app.jkt48connect.ui.components.AvatarStack
import app.jkt48connect.ui.components.BirthdayBubble
import app.jkt48connect.ui.components.CategoryPill
import app.jkt48connect.ui.components.Countdown
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.LiveCard
import app.jkt48connect.ui.components.NewsTile
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.PullRefresh
import app.jkt48connect.ui.components.RecentTile
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

@Composable
fun HomeScreen() {
    val nav = LocalNav.current
    val c = LocalColors.current
    val live = rememberLoad { Api.live(it) }
    val next = rememberLoad { Api.nextSchedule(it) }
    val recent = rememberLoad { Api.recent(1, it) }
    val birthdays = rememberLoad { Api.birthdays(it) }
    val news = rememberLoad { Api.news(1, it) }
    val state = rememberLazyListState()

    PullRefresh(onRefresh = {
        coroutineScope {
            listOf(async { live.refresh() }, async { next.refresh() }, async { recent.refresh() }).forEach { it.await() }
        }
    }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { Hero() }
            item { QuickActions() }
            item { SectionHead("Sedang berlangsung", "Live sekarang") { nav.tab = 1 } }
            item {
                val list = live.data
                when {
                    live.error != null && list == null -> ErrorRetry(live.error!!, { live.run(true) })
                    list == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(260.dp), 28.dp)
                    list.isEmpty() -> EmptyLive()
                    else -> LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        itemsIndexed(list) { i, l -> LiveCard(l, Modifier.fillParentMaxWidth(0.86f).staggerIn(i)) }
                    }
                }
            }
            item { SectionHead("Jangan sampai ketinggalan", "Show berikutnya") { nav.tab = 2 } }
            item {
                val shows = next.data
                when {
                    next.error != null && shows == null -> ErrorRetry(next.error!!, { next.run(true) })
                    shows == null -> Skeleton(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(170.dp), 28.dp)
                    shows.isNotEmpty() -> {
                        val show = shows.firstOrNull { it.category == "show" } ?: shows.first()
                        NextShow(show, Modifier.padding(horizontal = 16.dp)) { nav.push(Route.Theater(show.id, show.title)) }
                    }
                }
            }
            item { SectionHead("Rekap live", "Recent") { nav.tab = 3 } }
            val recentItems = recent.data?.items?.take(4)
            if (recentItems == null) {
                items(3) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(94.dp)) }
            } else {
                itemsIndexed(recentItems) { i, r ->
                    RecentTile(r, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.Recent(r)) }
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
            item { SectionHead("Kabar terbaru", "Berita") { nav.push(Route.News) } }
            news.data?.items?.take(3)?.let { list ->
                itemsIndexed(list) { i, n ->
                    NewsTile(n, i, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.NewsDetail(n)) }
                }
            }
            item {
                Column(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PixelLogo(18.dp)
                    VGap(10.dp)
                    Txt("Fan-made · tidak berafiliasi dengan JKT48 Operation Team", AppText.mono(10.5.sp, c.inkSoft))
                }
            }
        }
    }
}

/** Panel pembuka bergradasi merah: logo piksel yang tersusun, sapaan, tagline dengan baris bergaris tepi. */
@Composable
private fun Hero() {
    val c = LocalColors.current
    val hour = nowWib().hour
    val greet = when {
        hour < 11 -> "Selamat pagi"
        hour < 15 -> "Selamat siang"
        hour < 18 -> "Selamat sore"
        else -> "Selamat malam"
    }
    val spin by rememberInfiniteTransition(label = "hero").animateFloat(0f, 360f, infiniteRepeatable(tween(60_000, easing = LinearEasing)), label = "r")
    Box(
        Modifier
            .padding(16.dp, 6.dp, 16.dp, 0.dp)
            .shadow(28.dp, RoundedCornerShape(32.dp), ambientColor = c.brand, spotColor = c.brand)
            .clip(RoundedCornerShape(32.dp))
            .background(c.brandGradient)
            .fillMaxWidth()
            .staggerIn(0)
    ) {
        PixelLogo(
            210.dp,
            Modifier.align(Alignment.TopEnd).offset(46.dp, (-30).dp).graphicsLayer { rotationZ = spin; alpha = 0.14f },
            color = Color.White,
        )
        Column(Modifier.padding(22.dp, 22.dp, 22.dp, 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PixelLogo(26.dp, color = Color.White, assemble = true)
                Spacer(Modifier.width(12.dp))
                Txt("$greet · Fan Signal".uppercase(), AppText.micro(Color.White.copy(alpha = 0.78f)), Modifier.weight(1f), maxLines = 1)
                SignalBars(color = Color.White, height = 13.dp)
            }
            VGap(26.dp)
            Txt("YOUR OSHI.", AppText.display(48.sp, Color.White), Modifier.staggerIn(1))
            Txt("YOUR FRONT ROW", AppText.display(48.sp, Color.White).copy(drawStyle = Stroke(width = 3.2f)), Modifier.staggerIn(2))
            Txt("FEELING.", AppText.display(48.sp, Color.White), Modifier.staggerIn(3))
            VGap(14.dp)
            Txt("Live, jadwal theater, recap, dan member — semua dalam genggaman.", AppText.body(14.sp, Color.White.copy(alpha = 0.82f)), Modifier.staggerIn(4))
        }
    }
}

/** Pintasan kaca di bawah hero: tiap tombol bisa ditekan & ditarik, kacanya membal. */
@Composable
private fun QuickActions() {
    val c = LocalColors.current
    val nav = LocalNav.current
    val items = listOf(
        Triple(Icons.Rounded.Sensors, "Live") { nav.tab = 1 },
        Triple(Icons.Rounded.CalendarMonth, "Jadwal") { nav.tab = 2 },
        Triple(Icons.Rounded.Cake, "Ultah") { nav.push(Route.Birthday) },
        Triple(Icons.Rounded.Newspaper, "Berita") { nav.push(Route.News) },
    )
    Row(Modifier.padding(16.dp, 16.dp, 16.dp, 0.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items.forEachIndexed { i, (icon, label, onClick) ->
            LiquidButton(
                onClick = onClick,
                modifier = Modifier.weight(1f).height(72.dp).staggerIn(i + 2, 60),
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

@Composable
private fun EmptyLive() {
    val c = LocalColors.current
    Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth().appCard(24.dp).padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(46.dp).background(c.bg.copy(alpha = if (c.dark) 0.6f else 1f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
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

/** Show berikutnya: panel kontras dengan pil hitung mundur merah dan deret member. */
@Composable
private fun NextShow(show: TheaterShow, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Column(
        modifier
            .fillMaxWidth()
            .pressable(onClick)
            .clip(RoundedCornerShape(28.dp))
            .background(c.panel)
            .then(if (c.dark) Modifier.appCard(28.dp) else Modifier)
            .padding(20.dp)
            .staggerIn(0)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CategoryPill(show.category)
            Spacer(Modifier.width(8.dp))
            Txt("${fmtDate(show.date, "EEE, d MMM")} · ${fmtTime(show.date)}", AppText.mono(11.sp, Color.White.copy(alpha = 0.6f)), Modifier.weight(1f), maxLines = 1)
            ArrowCircle(bg = Color.White.copy(alpha = 0.12f), fg = Color.White, size = 32.dp)
        }
        VGap(14.dp)
        Txt(show.title.uppercase(), AppText.display(32.sp, Color.White))
        VGap(16.dp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.background(c.brandGradient, CircleShape).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.Timer, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(Color.White))
                Spacer(Modifier.width(6.dp))
                Countdown(show.date, AppText.mono(13.5.sp, Color.White, androidx.compose.ui.text.font.FontWeight.SemiBold))
            }
            Spacer(Modifier.weight(1f))
            if (show.members.isNotEmpty()) AvatarStack(show.members.map { it.img }, 28.dp, 5, ring = c.panel, extraColor = Color.White.copy(alpha = 0.6f))
        }
    }
}
