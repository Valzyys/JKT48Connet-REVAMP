package app.jkt48connect.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import app.jkt48connect.core.Notify
import app.jkt48connect.core.Updater
import app.jkt48connect.core.Push
import app.jkt48connect.ui.screens.AboutScreen
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.graphics.Brush
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.automirrored.rounded.ArrowBackIos
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
import androidx.compose.material.icons.rounded.SmartDisplay
import androidx.compose.material.icons.rounded.Forum
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
fun App(onDarkChanged: (Boolean) -> Unit, intro: Boolean, openTarget: String?, onOpened: () -> Unit) {
    val dark = isDarkTheme()
    var showIntro by rememberSaveable { mutableStateOf(intro) }
    AppTheme(dark) {
        val nav = remember { Nav() }
        // Ikon status bar putih saat intro (layar merah) dan penampil cuplikan (layar hitam).
        val immersive = nav.stack.lastOrNull() is Route.Shots
        LaunchedEffect(dark, showIntro, immersive) { onDarkChanged(dark || showIntro || immersive) }
        LaunchedEffect(openTarget) {
            openTarget?.let {
                if (it == "update") Updater.dialog = true else nav.open(it)
                onOpened()
            }
        }
        // Izin notifikasi (Android 13+) ditanyakan sekali, setelah intro selesai.
        val context = LocalContext.current
        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
        // Server push (FCM) disiapkan di latar; tanpa push, pemeriksaan berkala tetap berjalan.
        LaunchedEffect(Unit) { runCatching { Push.setup(context) } }
        // Setiap aplikasi dibuka: cek versi baru di GitHub Releases → pop-up update.
        LaunchedEffect(showIntro) {
            if (!showIntro) runCatching { Updater.check(context) }
        }
        LaunchedEffect(showIntro) {
            if (!showIntro && Build.VERSION.SDK_INT >= 33 && !Notify.permitted(context) && !Notify.askedOnce(context)) {
                delay(1200)
                Notify.markAsked(context)
                askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        val status = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        // Bilah navigasi ala iOS setinggi 52dp: isi mulai tepat di bawahnya (judul besar ada di dalam isi).
        val insets = PaddingValues(top = status + 52.dp, bottom = navBar + 100.dp)
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

        LaunchedEffect(Unit) {
            // Hangatkan cache tab lain (recent & arsip theater lambat di upstream) selagi beranda tampil.
            listOf<suspend () -> Unit>(
                { Api.recent(1) }, { Api.theater(1) }, { Api.nextSchedule() }, { Api.members() }, { Api.news(1) }, { Api.birthdays() },
            ).forEach { launch { runCatching { it() } } }
        }

        CompositionLocalProvider(LocalNav provides nav, LocalInsets provides insets) {
            Box(Modifier.fillMaxSize().background(LocalColors.current.bg)) {
                Ambient(Modifier.layerBackdrop(ambient))
                CompositionLocalProvider(LocalBackdrop provides ambient) {
                    Box(Modifier.fillMaxSize().layerBackdrop(content)) {
                        Pages(nav, Modifier.nestedScroll(scrollWatcher))
                    }
                }
                // Selama ada video tampil, kaca kepala/menu hanya membiaskan latar ambient (statis), bukan isi halaman:
                // kalau tidak, setiap frame video memaksa blur & refraksi kaca dihitung ulang dan video tersendat.
                CompositionLocalProvider(LocalBackdrop provides if (app.jkt48connect.ui.player.PlayerPresence.count > 0) ambient else overlay) {
                    val top = nav.stack.lastOrNull()
                    val scrolled = if (top == null) (offsets[nav.tab] ?: 0f) > compactPx else true
                    if (top !is Route.Shots && top !is Route.Member) TopScrim(status + 60.dp, if (top == null) scrolled else true)
                    AnimatedContent(
                        targetState = top == null,
                        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(160)) },
                        label = "chrome",
                    ) { onTabs ->
                        Box(Modifier.fillMaxSize()) {
                            if (onTabs) {
                                NavBar(
                                    title = TAB_TITLES[nav.tab],
                                    showTitle = (offsets[nav.tab] ?: 0f) > compactPx * 2,
                                    back = false,
                                    modifier = Modifier.align(Alignment.TopCenter).padding(top = status),
                                )
                                LiquidTabs(
                                    items = TABS,
                                    selectedIndex = nav.tab,
                                    onSelected = { nav.tab = it },
                                    height = 62.dp,
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .padding(start = 16.dp, end = 16.dp, bottom = navBar + 12.dp)
                                        .widthIn(max = 520.dp)
                                        .fillMaxWidth(),
                                )
                            } else {
                                (nav.stack.lastOrNull())?.let { r ->
                                    if (r !is Route.Shots) NavBar(title(r), showTitle = true, back = true, modifier = Modifier.align(Alignment.TopCenter).padding(top = status))
                                }
                            }
                        }
                    }
                    MenuPopover(nav, status)
                    UpdateDialog()
                }
                if (showIntro) Intro { showIntro = false }
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
    Route.About -> "Tentang"
    Route.Donate -> "Donasi"
    Route.Videos -> "Video"
    is Route.VideoDetail -> r.video.channel.ifEmpty { "Video" }
    is Route.Social -> if (r.memberName.isNotEmpty()) "Sosmed ${r.memberName}" else "Sosmed"
    is Route.Post -> r.post.platformLabel
    is Route.Watch -> r.live.name.ifEmpty { "Live" }
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
                is Route.Shots -> ShotViewer(route.urls, route.start, route.title)
                Route.About -> AboutScreen()
                Route.Donate -> app.jkt48connect.ui.screens.DonateScreen()
                Route.Videos -> app.jkt48connect.ui.screens.VideosScreen()
                is Route.VideoDetail -> app.jkt48connect.ui.screens.VideoDetailScreen(route.video)
                is Route.Social -> app.jkt48connect.ui.screens.SocialScreen(route.platform, route.member, route.memberName)
                is Route.Post -> app.jkt48connect.ui.screens.PostDetailScreen(route.post)
                is Route.Watch -> app.jkt48connect.ui.screens.WatchScreen(route.live)
            }
        }
    }
}


private val TAB_TITLES = listOf("JKT48Connect", "Live", "Jadwal", "Recent", "Member")

/**
 * Bilah navigasi seperti aplikasi iPhone (iOS 26): tombol kaca bulat di kiri (kembali, hanya di halaman detail),
 * judul di tengah (halaman detail, atau tab setelah judul besarnya tergulir), dan tombol kaca "•••" merah di kanan
 * yang membuka menu.
 */
@Composable
private fun NavBar(title: String, showTitle: Boolean, back: Boolean, modifier: Modifier) {
    val c = LocalColors.current
    val nav = LocalNav.current
    Box(modifier.padding(horizontal = 16.dp).widthIn(max = 560.dp).fillMaxWidth().height(52.dp)) {
        if (back) {
            LiquidIconButton(
                Icons.AutoMirrored.Rounded.ArrowBackIos, { nav.pop() }, Modifier.align(Alignment.CenterStart).padding(top = 4.dp),
                size = 44.dp, iconSize = 18.dp, iconColor = c.ink, contentDescription = "Kembali",
            )
        }
        AnimatedVisibility(
            showTitle && title.isNotEmpty(),
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 60.dp, vertical = 0.dp).padding(top = 4.dp),
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(140)),
        ) {
            Txt(title, AppText.body(17.sp, c.ink, 700), maxLines = 1)
        }
        LiquidIconButton(
            Icons.Rounded.MoreHoriz, { nav.menuOpen = true }, Modifier.align(Alignment.CenterEnd).padding(top = 4.dp),
            size = 44.dp, iconSize = 24.dp, iconColor = c.brand, contentDescription = "Menu",
        )
    }
}

/** Tepi atas yang memudar (scroll edge effect iOS 26) supaya isi yang tergulir tidak bertabrakan dengan bilah. */
@Composable
private fun TopScrim(height: androidx.compose.ui.unit.Dp, visible: Boolean) {
    val c = LocalColors.current
    val a by animateFloatAsState(if (visible) 1f else 0f, tween(200), label = "scrim")
    Box(
        Modifier.fillMaxWidth().height(height).graphicsLayer { alpha = a }
            .background(Brush.verticalGradient(0f to c.bg.copy(alpha = 0.92f), 0.6f to c.bg.copy(alpha = 0.7f), 1f to c.bg.copy(alpha = 0f))),
    )
}

/**
 * Menu "•••" seperti `Menu` SwiftUI: panel kaca kecil yang mekar dari pojok kanan atas, berisi halaman yang tidak
 * ada di tab. Ketuk di luar panel untuk menutup.
 */
@Composable
private fun MenuPopover(nav: Nav, status: androidx.compose.ui.unit.Dp) {
    val c = LocalColors.current
    val backdrop = LocalBackdrop.current
    AnimatedVisibility(nav.menuOpen, enter = fadeIn(tween(160)), exit = fadeOut(tween(160))) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = if (c.dark) 0.25f else 0.08f)).clickable(interactionSource = null, indication = null) { nav.menuOpen = false })
    }
    Box(Modifier.fillMaxSize().padding(top = status + 54.dp, end = 12.dp), contentAlignment = Alignment.TopEnd) {
        AnimatedVisibility(
            nav.menuOpen,
            enter = scaleIn(spring(0.72f, 420f), initialScale = 0.3f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)) + fadeIn(tween(120)),
            exit = scaleOut(tween(160), targetScale = 0.6f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)) + fadeOut(tween(140)),
        ) {
            Column(
                Modifier
                    .width(260.dp)
                    .glass(backdrop, RoundedRectangle(26.dp), if (c.dark) Color(0xFF1C1C1E).copy(alpha = 0.72f) else Color.White.copy(alpha = 0.72f), blur = 6.dp, lensHeight = 18.dp, lensAmount = 28.dp)
                    .clickable(interactionSource = null, indication = null) {}
                    .padding(vertical = 6.dp),
            ) {
                fun go(r: Route) {
                    nav.menuOpen = false
                    nav.push(r)
                }
                MenuRow("Video YouTube", Icons.Rounded.SmartDisplay) { go(Route.Videos) }
                MenuRow("Sosmed member", Icons.Rounded.Forum) { go(Route.Social()) }
                MenuRow("Berita", Icons.Rounded.Newspaper) { go(Route.News) }
                MenuRow("Ulang tahun", Icons.Rounded.Cake) { go(Route.Birthday) }
                Box(Modifier.padding(vertical = 5.dp).fillMaxWidth().height(6.dp).background(c.ink.copy(alpha = 0.06f)))
                MenuRow("Dukung (donasi)", Icons.Rounded.Favorite, c.brand) { go(Route.Donate) }
                MenuRow("Tentang aplikasi", Icons.Rounded.Info) { go(Route.About) }
            }
        }
    }
}

@Composable
private fun MenuRow(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color = LocalColors.current.ink, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        androidx.compose.foundation.Image(icon, null, Modifier.size(20.dp), colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(color))
        Spacer(Modifier.width(14.dp))
        Txt(label, AppText.body(16.sp, color, 500), maxLines = 1)
    }
}
