package app.jkt48connect.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Cake
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.fmtWib
import app.jkt48connect.core.nowWib
import app.jkt48connect.ui.components.CountUp
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.Ambient
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LiquidTabs
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.TabItem
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import app.jkt48connect.ui.screens.BirthdayScreen
import app.jkt48connect.ui.screens.HomeScreen
import app.jkt48connect.ui.screens.LiveScreen
import app.jkt48connect.ui.screens.MemberDetailScreen
import app.jkt48connect.ui.screens.MembersScreen
import app.jkt48connect.ui.screens.NewsDetailScreen
import app.jkt48connect.ui.screens.NewsScreen
import app.jkt48connect.ui.screens.RecentDetailScreen
import app.jkt48connect.ui.screens.RecentScreen
import app.jkt48connect.ui.screens.ScheduleScreen
import app.jkt48connect.ui.screens.ShotViewer
import app.jkt48connect.ui.screens.TheaterDetailScreen
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.AppTheme
import app.jkt48connect.ui.theme.LocalColors
import app.jkt48connect.ui.theme.ThemeController
import app.jkt48connect.ui.theme.ThemeMode
import app.jkt48connect.ui.theme.isDarkTheme
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberCombinedBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val TABS = listOf(
    TabItem("Beranda", Icons.Rounded.Home),
    TabItem("Live", Icons.Rounded.Sensors),
    TabItem("Jadwal", Icons.Rounded.CalendarMonth),
    TabItem("Recent", Icons.Rounded.History),
    TabItem("Member", Icons.Rounded.Groups),
)

@Composable
fun App(onDarkChanged: (Boolean) -> Unit) {
    val dark = isDarkTheme()
    LaunchedEffect(dark) { onDarkChanged(dark) }
    AppTheme(dark) {
        val nav = remember { Nav() }
        val status = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        val insets = PaddingValues(top = status + 80.dp, bottom = navBar + 104.dp)
        BackHandler(enabled = nav.menuOpen || nav.stack.isNotEmpty() || nav.tab != 0) {
            if (!nav.pop()) nav.tab = 0
        }

        // Dua lapis backdrop: latar ambient (untuk kaca di dalam halaman) dan isi halaman
        // (untuk kaca yang mengapung di atasnya: kepala atas, tab bar, lembar menu).
        val ambient = rememberLayerBackdrop()
        val content = rememberLayerBackdrop()
        val overlay = rememberCombinedBackdrop(ambient, content)

        // Posisi gulir tiap tab, supaya kepala atas tahu kapan harus ringkas.
        val offsets = remember { mutableStateMapOf<Int, Float>() }
        val scrollWatcher = remember {
            object : NestedScrollConnection {
                override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                    offsets[nav.tab] = ((offsets[nav.tab] ?: 0f) - consumed.y).coerceAtLeast(0f)
                    return Offset.Zero
                }
            }
        }
        val compactPx = with(LocalDensity.current) { 24.dp.toPx() }

        var liveCount by remember { mutableStateOf<Int?>(null) }
        LaunchedEffect(Unit) {
            while (true) {
                runCatching { liveCount = Api.live().size }
                delay(60_000)
            }
        }

        CompositionLocalProvider(LocalNav provides nav, LocalInsets provides insets) {
            Box(Modifier.fillMaxSize().background(LocalColors.current.bg)) {
                Ambient(Modifier.layerBackdrop(ambient))
                CompositionLocalProvider(LocalBackdrop provides ambient) {
                    Box(Modifier.fillMaxSize().layerBackdrop(content)) {
                        Pages(nav, Modifier.nestedScroll(scrollWatcher))
                    }
                }
                CompositionLocalProvider(LocalBackdrop provides overlay) {
                    val top = nav.stack.lastOrNull()
                    AnimatedContent(
                        targetState = top == null,
                        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(160)) },
                        label = "chrome",
                    ) { onTabs ->
                        Box(Modifier.fillMaxSize()) {
                            if (onTabs) {
                                AppHeader(
                                    compact = (offsets[nav.tab] ?: 0f) > compactPx,
                                    subtitle = headerSubtitle(nav.tab, liveCount),
                                    liveCount = liveCount,
                                    modifier = Modifier.align(Alignment.TopCenter).padding(top = status + 6.dp),
                                )
                                LiquidTabs(
                                    items = TABS,
                                    selectedIndex = nav.tab,
                                    onSelected = { nav.tab = it },
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .padding(start = 14.dp, end = 14.dp, bottom = navBar + 16.dp)
                                        .widthIn(max = 520.dp)
                                        .fillMaxWidth(),
                                )
                            } else {
                                (nav.stack.lastOrNull())?.let { r ->
                                    if (r !is Route.Shots) DetailHeader(title(r), Modifier.align(Alignment.TopCenter).padding(top = status + 6.dp))
                                }
                            }
                        }
                    }
                    MenuSheet(nav)
                }
            }
        }
    }
}

private fun title(r: Route): String = when (r) {
    is Route.Recent -> r.item.name
    is Route.Member -> r.name.ifEmpty { "Member" }
    is Route.Theater -> r.title
    Route.Birthday -> "Ulang tahun"
    Route.News, is Route.NewsDetail -> "Berita"
    is Route.Shots -> ""
}

/** Tab utama (dipertahankan state-nya) + halaman detail yang meluncur dari kanan. */
@Composable
private fun Pages(nav: Nav, modifier: Modifier) {
    val holder = rememberSaveableStateHolder()
    Box(modifier.fillMaxSize()) {
        AnimatedContent(
            targetState = nav.stack.size to nav.stack.lastOrNull(),
            transitionSpec = {
                val forward = targetState.first >= initialState.first
                if (forward) {
                    (slideInHorizontally(spring(0.9f, 500f)) { it / 3 } + fadeIn(tween(200))) togetherWith
                        (slideOutHorizontally(tween(260)) { -it / 8 } + fadeOut(tween(200)))
                } else {
                    (slideInHorizontally(tween(260)) { -it / 8 } + fadeIn(tween(200))) togetherWith
                        (slideOutHorizontally(spring(0.9f, 500f)) { it / 3 } + fadeOut(tween(200)))
                }
            },
            label = "pages",
        ) { (_, route) ->
            when (route) {
                null -> AnimatedContent(nav.tab, transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(120)) }, label = "tab") { tab ->
                    holder.SaveableStateProvider("tab$tab") {
                        when (tab) {
                            0 -> HomeScreen()
                            1 -> LiveScreen()
                            2 -> ScheduleScreen()
                            3 -> RecentScreen()
                            else -> MembersScreen()
                        }
                    }
                }
                is Route.Recent -> RecentDetailScreen(route.item)
                is Route.Member -> MemberDetailScreen(route.id, route.name, route.img)
                is Route.Theater -> TheaterDetailScreen(route.id)
                Route.Birthday -> BirthdayScreen()
                Route.News -> NewsScreen()
                is Route.NewsDetail -> NewsDetailScreen(route.item)
                is Route.Shots -> ShotViewer(route.urls, route.start)
            }
        }
    }
}

fun headerSubtitle(tab: Int, liveCount: Int?): String = when (tab) {
    0 -> "Beranda · ${fmtWib(nowWib(), "EEE, d MMM")}"
    1 -> if ((liveCount ?: 0) > 0) "$liveCount member sedang live" else "Belum ada yang live"
    2 -> "Jadwal theater & event"
    3 -> "Rekap live terbaru"
    else -> "Direktori member"
}

/**
 * Kepala atas ala iOS 26: tiga lensa kaca terpisah yang bisa ditekan & ditarik —
 * kapsul merek, pil status live, dan tombol menu. Mengecil saat isi digulir.
 */
@Composable
private fun AppHeader(compact: Boolean, subtitle: String, liveCount: Int?, modifier: Modifier) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val h by animateDpAsState(if (compact) 46.dp else 56.dp, spring(0.8f, 400f), label = "h")
    val live = (liveCount ?: 0) > 0
    Row(modifier.padding(horizontal = 14.dp).widthIn(max = 520.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LiquidButton(
            onClick = { nav.tab = 0 },
            modifier = Modifier.weight(1f).height(h),
            contentPadding = PaddingValues(start = 10.dp, end = 14.dp),
            horizontalArrangement = Arrangement.Start,
        ) {
            Box(Modifier.size(h - 22.dp).background(c.brandGradient, RoundedRectangle(10.dp)), contentAlignment = Alignment.Center) {
                PixelLogo(h * 0.36f, color = Color.White)
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Row {
                    Txt("JKT48", AppText.display(if (compact) 19.sp else 21.sp, c.ink))
                    Txt("CONNECT", AppText.display(if (compact) 19.sp else 21.sp, c.brand))
                }
                AnimatedVisibility(!compact) {
                    AnimatedContent(subtitle, transitionSpec = {
                        (slideInVertically { it } + fadeIn()) togetherWith (slideOutVertically { -it } + fadeOut())
                    }, label = "sub") { s ->
                        Txt(s.uppercase(), AppText.micro(c.inkSoft, 9.sp), Modifier.padding(top = 3.dp), maxLines = 1)
                    }
                }
            }
        }
        LiquidButton(
            onClick = { nav.tab = 1 },
            modifier = Modifier.height(h),
            tint = if (live) Color(0xFFE1243A) else Color.Unspecified,
            contentPadding = PaddingValues(horizontal = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            SignalBars(color = if (live) Color.White else c.inkSoft, height = 13.dp, active = live)
            Column {
                CountUp(liveCount, AppText.display(if (compact) 18.sp else 20.sp, if (live) Color.White else c.ink))
                if (!compact) Txt("LIVE", AppText.micro(if (live) Color.White.copy(alpha = 0.75f) else c.inkSoft, 8.5.sp))
            }
        }
        LiquidIconButton(Icons.Rounded.GridView, { nav.menuOpen = true }, size = h, iconSize = if (compact) 19.dp else 21.dp, contentDescription = "Menu")
    }
}

/** Kepala halaman detail: tombol kembali bulat + kapsul judul. */
@Composable
private fun DetailHeader(title: String, modifier: Modifier) {
    val c = LocalColors.current
    val nav = LocalNav.current
    Row(modifier.padding(horizontal = 14.dp).widthIn(max = 520.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LiquidIconButton(Icons.AutoMirrored.Rounded.ArrowBack, { nav.pop() }, size = 52.dp, contentDescription = "Kembali")
        Box(
            Modifier.weight(1f).height(52.dp).glass(LocalBackdrop.current, Capsule(), glassFill()).padding(horizontal = 18.dp),
            contentAlignment = Alignment.Center,
        ) {
            Txt(title, AppText.body(15.5.sp, c.ink, 800), maxLines = 1)
        }
    }
}

/**
 * Lembar menu kaca (kaca di atas kaca lewat `exportedBackdrop`): pintasan Ulang tahun & Berita
 * sebagai tombol kaca, dan pilihan tema dengan pil kaca yang bisa diseret. Tarik ke bawah untuk menutup.
 */
@Composable
private fun MenuSheet(nav: Nav) {
    val c = LocalColors.current
    val backdrop = LocalBackdrop.current
    val scope = rememberCoroutineScope()
    val dragY = remember { Animatable(0f) }
    LaunchedEffect(nav.menuOpen) { if (nav.menuOpen) dragY.snapTo(0f) }
    AnimatedVisibility(nav.menuOpen, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = if (c.dark) 0.45f else 0.25f)).clickable(interactionSource = null, indication = null) { nav.menuOpen = false })
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(
            nav.menuOpen,
            enter = slideInVertically(spring(0.75f, 380f)) { it } + scaleIn(spring(0.7f, 380f), initialScale = 0.92f),
            exit = slideOutVertically(tween(220)) { it } + scaleOut(tween(220), targetScale = 0.95f),
        ) {
            val sheetBackdrop = rememberLayerBackdrop()
            val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
            Column(
                Modifier
                    .padding(start = 10.dp, end = 10.dp, bottom = navBar + 10.dp)
                    .widthIn(max = 560.dp)
                    .fillMaxWidth()
                    .graphicsLayer { translationY = dragY.value }
                    .pointerInput(Unit) {
                        detectVerticalDragGestures(
                            onDragEnd = {
                                scope.launch {
                                    if (dragY.value > 140f) nav.menuOpen = false else dragY.animateTo(0f, spring(0.6f, 400f))
                                }
                            },
                        ) { _, amount -> scope.launch { dragY.snapTo((dragY.value + amount).coerceAtLeast(0f)) } }
                    }
                    .glass(backdrop, RoundedRectangle(40.dp), glassFill(), blur = 8.dp, lensHeight = 24.dp, lensAmount = 48.dp, depth = true, exportedBackdrop = sheetBackdrop)
                    .clickable(interactionSource = null, indication = null) {}
                    .padding(20.dp),
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally).size(40.dp, 5.dp).background(c.inkSoft.copy(alpha = 0.4f), RoundedCornerShape(3.dp)))
                VGap(14.dp)
                Micro("Menu", color = c.brand, dot = true)
                VGap(6.dp)
                Txt("JELAJAHI", AppText.display(30.sp, c.ink))
                VGap(14.dp)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MenuTile(Icons.Rounded.Cake, "Ulang tahun", "Member yang segera berulang tahun", Modifier.weight(1f), sheetBackdrop) {
                        nav.menuOpen = false
                        nav.push(Route.Birthday)
                    }
                    MenuTile(Icons.Rounded.Newspaper, "Berita", "Kabar terbaru dari jkt48.com", Modifier.weight(1f), sheetBackdrop) {
                        nav.menuOpen = false
                        nav.push(Route.News)
                    }
                }
                VGap(22.dp)
                Micro("Tema · tarik pilnya", color = c.brand, dot = true)
                VGap(10.dp)
                LiquidTabs(
                    items = listOf(TabItem("Sistem"), TabItem("Putih"), TabItem("Gelap")),
                    selectedIndex = ThemeController.mode.ordinal,
                    onSelected = { ThemeController.set(ThemeMode.entries[it]) },
                    height = 52.dp,
                    backdrop = sheetBackdrop,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun MenuTile(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    hint: String,
    modifier: Modifier,
    backdrop: com.kyant.backdrop.Backdrop,
    onClick: () -> Unit,
) {
    val c = LocalColors.current
    LiquidButton(
        onClick = onClick,
        modifier = modifier,
        backdrop = backdrop,
        shape = RoundedRectangle(24.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.Start,
    ) {
        Column {
            Box(Modifier.size(42.dp).background(c.brandGradient, RoundedRectangle(14.dp)), contentAlignment = Alignment.Center) {
                androidx.compose.foundation.Image(icon, null, Modifier.size(21.dp), colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(Color.White))
            }
            VGap(14.dp)
            Txt(label, AppText.body(15.sp, c.ink, 800))
            Txt(hint, AppText.body(12.sp, c.inkSoft), maxLines = 2)
        }
    }
}
