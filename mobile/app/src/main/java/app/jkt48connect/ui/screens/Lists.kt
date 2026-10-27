package app.jkt48connect.ui.screens

import app.jkt48connect.core.Favorites
import androidx.compose.material.icons.rounded.Star
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.Member
import app.jkt48connect.core.daysUntil
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.nowWib
import app.jkt48connect.core.parseWib
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.PagedLoad
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.CountUp
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.LiveCard
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.NewsTile
import app.jkt48connect.ui.components.PageHeader
import app.jkt48connect.ui.components.PhotoScrim
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.PullRefresh
import app.jkt48connect.ui.components.RecentTile
import app.jkt48connect.ui.components.ShowTile
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidTabs
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.TabItem
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.rememberPaged
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.shapes.Capsule
import kotlinx.coroutines.delay

/** Muat halaman berikutnya saat daftar hampir habis. */
@Composable
private fun LoadMoreOnEnd(state: LazyListState, load: PagedLoad<*>) = LoadMoreOnEnd(state, load) { load.more() }

@Composable
fun LoadMoreOnEnd(state: LazyListState, key: Any, onEnd: () -> Unit) {
    LaunchedEffect(state, key) {
        snapshotFlow { state.layoutInfo.let { (it.visibleItemsInfo.lastOrNull()?.index ?: 0) >= it.totalItemsCount - 4 } }
            .collect { if (it) onEnd() }
    }
}

/** Semua member yang sedang live; diperbarui otomatis tiap 30 detik. */
@Composable
fun LiveScreen() {
    val c = LocalColors.current
    val live = rememberLoad { Api.live(it) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            live.run(true)
        }
    }
    val list = live.data
    PullRefresh(onRefresh = { live.refresh() }) {
        LazyColumn(state = rememberLazyListState(), contentPadding = LocalInsets.current) {
            item {
                PageHeader("IDN Live · Showroom", "Live sekarang") {
                    Column(horizontalAlignment = Alignment.End) {
                        CountUp(list?.size ?: 0, AppText.display(48.sp, if (list.isNullOrEmpty()) c.inkSoft else c.brand))
                        Txt("MEMBER", AppText.micro(c.inkSoft))
                    }
                }
            }
            when {
                live.error != null && list == null -> item { ErrorRetry(live.error!!, { live.run(true) }) }
                list == null -> items(2) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 14.dp).fillMaxWidth().height(300.dp), 28.dp) }
                list.isEmpty() -> item {
                    Column(
                        Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().appCard(28.dp).padding(horizontal = 24.dp, vertical = 36.dp).staggerIn(0),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(76.dp).background(c.bg.copy(alpha = if (c.dark) 0.6f else 1f), CircleShape), contentAlignment = Alignment.Center) {
                            SignalBars(color = c.inkSoft, height = 30.dp, active = false)
                        }
                        VGap(16.dp)
                        Txt("BELUM ADA YANG LIVE", AppText.display(28.sp, c.ink))
                        VGap(8.dp)
                        Txt(
                            "Halaman ini memperbarui sendiri setiap 30 detik.\nTarik ke bawah untuk cek sekarang.",
                            AppText.body(14.sp, c.inkSoft).copy(textAlign = TextAlign.Center),
                        )
                    }
                }
                else -> itemsIndexed(list) { i, l -> LiveCard(l, Modifier.padding(16.dp, 0.dp, 16.dp, 14.dp).staggerIn(i), 300.dp) }
            }
        }
    }
}

/** Jadwal mendatang (show, event, exclusive) dan arsip theater, dipilih lewat segmented kaca yang bisa diseret. */
@Composable
fun ScheduleScreen() {
    val nav = LocalNav.current
    var seg by rememberSaveable { mutableIntStateOf(0) }
    val next = rememberLoad { Api.nextSchedule(it) }
    val theater = rememberPaged { page, force -> Api.theater(page, force) }
    val state = rememberLazyListState()
    if (seg == 1) LoadMoreOnEnd(state, theater)
    PullRefresh(onRefresh = { if (seg == 0) next.refresh() else theater.refresh() }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { PageHeader("Theater & event", "Jadwal") }
            item {
                LiquidTabs(
                    items = listOf(TabItem("Mendatang"), TabItem("Theater")),
                    selectedIndex = seg,
                    onSelected = { seg = it },
                    height = 50.dp,
                    modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                )
                VGap(16.dp)
            }
            if (seg == 0) {
                val shows = next.data
                when {
                    next.error != null && shows == null -> item { ErrorRetry(next.error!!, { next.run(true) }) }
                    shows == null -> items(4) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(96.dp)) }
                    else -> {
                        var index = 0
                        shows.groupBy { fmtDate(it.date, "EEEE, d MMMM") }.forEach { (day, group) ->
                            item(key = "h$day") { Micro(day, Modifier.padding(22.dp, 10.dp, 22.dp, 8.dp)) }
                            group.forEach { show ->
                                val i = index++
                                item(key = "n${show.id}$i") {
                                    ShowTile(show, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i)) { nav.push(Route.Theater(show.id, show.title)) }
                                }
                            }
                        }
                    }
                }
            } else {
                itemsIndexed(theater.items, key = { i, s -> "t${s.id}$i" }) { i, show ->
                    ShowTile(show, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i % 12)) { nav.push(Route.Theater(show.id, show.title)) }
                }
                theater.error?.let { e -> item { ErrorRetry(e, { theater.more() }) } }
                if (theater.loading) item { Loading() }
            }
        }
    }
}

@Composable
fun Loading() {
    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Spinner() }
}

@Composable
fun Spinner() {
    val t by rememberInfiniteTransition(label = "sp").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "r")
    PixelLogo(22.dp, Modifier.graphicsLayer { rotationZ = t })
}

/** Daftar rekap live dengan muat-lanjut saat menggulir. */
@Composable
fun RecentScreen() {
    val nav = LocalNav.current
    val recent = rememberPaged { page, force -> Api.recent(page, force) }
    val state = rememberLazyListState()
    LoadMoreOnEnd(state, recent)
    PullRefresh(onRefresh = { recent.refresh() }) {
        LazyColumn(state = state, contentPadding = LocalInsets.current) {
            item { PageHeader("Gift · supporter · replay", "Recent") }
            if (recent.items.isEmpty() && recent.loading) items(5) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(94.dp)) }
            itemsIndexed(recent.items, key = { i, r -> "${r.id}$i" }) { i, r ->
                RecentTile(r, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i % 12)) { nav.push(Route.Recent(r)) }
            }
            recent.error?.let { e -> item { ErrorRetry(e, { recent.more() }) } }
            if (recent.loading && recent.items.isNotEmpty()) item { Loading() }
        }
    }
}

/** Grid member dengan kolom cari kaca dan pilihan aktif / lulus (pil kaca yang bisa diseret). */
@Composable
fun MembersScreen() {
    val c = LocalColors.current
    val nav = LocalNav.current
    val members = rememberLoad { Api.members(it) }
    var q by rememberSaveable { mutableStateOf("") }
    var seg by rememberSaveable { mutableIntStateOf(0) }
    val all = members.data.orEmpty()
    val list = all
        .filter { if (seg == 2) Favorites.isFavorite(it.id) else (seg == 0) != it.isGraduate }
        .filter { q.isEmpty() || "${it.name} ${it.nickname}".contains(q, ignoreCase = true) }
    val insets = LocalInsets.current
    PullRefresh(onRefresh = { members.refresh() }) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(160.dp),
            state = rememberLazyGridState(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = insets.calculateTopPadding(), bottom = insets.calculateBottomPadding()),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column {
                    PageHeader("JKT48", "Member", horizontal = 4.dp) { CountUp(list.size, AppText.display(48.sp, c.brand)) }
                    // Kolom cari: kaca statis.
                    Row(
                        Modifier.fillMaxWidth().height(50.dp).glass(LocalBackdrop.current, Capsule(), glassFill()).padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Image(Icons.Rounded.Search, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.inkSoft))
                        Spacer(Modifier.width(10.dp))
                        Box(Modifier.weight(1f)) {
                            if (q.isEmpty()) Txt("Cari oshi kamu…", AppText.body(15.sp, c.inkSoft))
                            BasicTextField(q, { q = it }, singleLine = true, textStyle = AppText.body(15.sp, c.ink), cursorBrush = SolidColor(c.brand), modifier = Modifier.fillMaxWidth())
                        }
                    }
                    VGap(14.dp)
                    LiquidTabs(
                        items = listOf(TabItem("Aktif"), TabItem("Lulus"), TabItem("Favorit")),
                        selectedIndex = seg,
                        onSelected = { seg = it },
                        height = 50.dp,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    VGap(4.dp)
                }
            }
            when {
                members.error != null && members.data == null -> item(span = { GridItemSpan(maxLineSpan) }) { ErrorRetry(members.error!!, { members.run(true) }) }
                members.data == null -> items(8) { Skeleton(Modifier.aspectRatio(0.7f), 24.dp) }
                seg == 2 && list.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                    Txt("Belum ada favorit. Buka profil member lalu ketuk ☆ untuk menjadikannya oshi.", AppText.body(14.sp, c.inkSoft), Modifier.padding(8.dp, 12.dp))
                }
                else -> itemsIndexed(list, key = { _, m -> m.id }) { i, m -> MemberCard(m, i, Modifier.staggerIn(i % 12, 35)) { nav.push(Route.Member(m.id, m.name, m.img)) } }
            }
        }
    }
}

@Composable
private fun MemberCard(m: Member, index: Int, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Box(modifier.aspectRatio(0.7f).pressable(onClick).clip(RoundedCornerShape(24.dp))) {
        NetImage(m.img, Modifier.fillMaxSize(), fallback = m.name)
        Box(Modifier.fillMaxSize().background(PhotoScrim))
        Box(Modifier.padding(10.dp).background(c.brandGradient, CircleShape).padding(horizontal = 7.dp, vertical = 2.dp)) {
            Txt((index + 1).toString().padStart(2, '0'), AppText.mono(10.sp, Color.White, androidx.compose.ui.text.font.FontWeight.SemiBold))
        }
        if (Favorites.isFavorite(m.id)) {
            Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(26.dp).background(c.brandGradient, CircleShape), contentAlignment = Alignment.Center) {
                Image(Icons.Rounded.Star, "Favorit", Modifier.size(15.dp), colorFilter = ColorFilter.tint(Color.White))
            }
        }
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Txt(m.shortName.uppercase(), AppText.display(22.sp, Color.White), maxLines = 1)
            Txt(m.name, AppText.body(11.5.sp, Color.White.copy(alpha = 0.75f)), maxLines = 1)
        }
    }
}

/** Ulang tahun member terdekat; yang hari ini disorot merah. */
@Composable
fun BirthdayScreen() {
    val c = LocalColors.current
    val nav = LocalNav.current
    val data = rememberLoad { Api.birthdays(it) }
    val list = data.data?.sortedBy { daysUntil(it.birthdate) }
    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)) {
        when {
            data.error != null && list == null -> item { ErrorRetry(data.error!!, { data.run(true) }) }
            list == null -> item { Loading() }
            else -> itemsIndexed(list) { i, b ->
                val d = daysUntil(b.birthdate)
                val born = parseWib(b.birthdate)
                val age = born?.let { nowWib().plusDays(d.toLong()).year - it.year }
                val today = d == 0
                Row(
                    Modifier
                        .padding(bottom = 10.dp)
                        .fillMaxWidth()
                        .pressable({ nav.push(Route.Member(b.id, b.name, b.img)) })
                        .then(if (today) Modifier.clip(RoundedCornerShape(24.dp)).background(c.brandGradient) else Modifier.appCard(24.dp))
                        .padding(12.dp)
                        .staggerIn(i),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    NetImage(b.img, Modifier.size(56.dp, 66.dp).clip(RoundedCornerShape(16.dp)), fallback = b.name)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Txt(b.name, AppText.body(16.sp, if (today) Color.White else c.ink, 800))
                        VGap(3.dp)
                        Txt(
                            fmtDate(b.birthdate, "d MMMM") + (age?.let { " · genap $it tahun" } ?: ""),
                            AppText.mono(11.5.sp, if (today) Color.White.copy(alpha = 0.75f) else c.inkSoft),
                        )
                    }
                    if (today) Txt("🎉", AppText.display(30.sp)) else Row(verticalAlignment = Alignment.Bottom) {
                        Txt("$d", AppText.display(30.sp, c.brand))
                        Txt("HARI", AppText.micro(c.inkSoft, 9.sp), Modifier.padding(start = 4.dp, bottom = 4.dp))
                    }
                }
            }
        }
    }
}

/** Daftar berita dengan muat-lanjut. */
@Composable
fun NewsScreen() {
    val nav = LocalNav.current
    val news = rememberPaged { page, force -> Api.news(page, force) }
    val state = rememberLazyListState()
    LoadMoreOnEnd(state, news)
    LazyColumn(state = state, contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)) {
        itemsIndexed(news.items, key = { i, n -> "${n.id}$i" }) { i, n ->
            NewsTile(n, i, Modifier.padding(bottom = 10.dp).staggerIn(i % 10)) { nav.push(Route.NewsDetail(n)) }
        }
        news.error?.let { e -> item { ErrorRetry(e, { news.more() }) } }
        if (news.loading) item { Loading() }
    }
}
