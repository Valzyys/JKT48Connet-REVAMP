package app.jkt48connect.stream

import android.Manifest
import android.app.Activity
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.view.WindowCompat
import app.jkt48connect.stream.ui.components.Ambient
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberCombinedBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

// ---------------------------------------------------------------- Navigasi

/** Halaman di atas tab (seperti `NavigationStack` iPhone): tiap tab punya tumpukannya sendiri. */
sealed interface Route {
    val title: String

    data class Theater(val item: JSONObject) : Route {
        override val title: String get() = item.optString("title")
    }

    data class Recent(val item: JSONObject) : Route {
        override val title: String get() = item.optString("title")
    }

    data class Watch(val item: JSONObject) : Route {
        override val title: String get() = item.optString("title")
    }

    data class Pay(val payment: JSONObject) : Route {
        override val title: String get() = "Pembayaran"
    }

    /** Gambar layar penuh (cuplikan, poster, foto). */
    data class Gallery(val urls: List<String>, val start: Int, override val title: String, val caption: String) : Route
}

@Stable
class StreamNav {
    private var current by mutableIntStateOf(0)
    var tab: Int
        get() = current
        set(value) {
            Motion.lastNav = System.currentTimeMillis()
            menuOpen = false
            current = value
        }
    val stacks = List(TAB_ITEMS.size) { mutableStateListOf<Route>() }
    var reload by mutableIntStateOf(0)
    var menuOpen by mutableStateOf(false)
    val top: Route? get() = stacks[current].lastOrNull()

    fun push(route: Route) {
        Motion.lastNav = System.currentTimeMillis()
        menuOpen = false
        stacks[current].add(route)
    }

    fun pop(): Boolean {
        val stack = stacks[current]
        if (stack.isEmpty()) return false
        Motion.lastNav = System.currentTimeMillis()
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Buka gambar layar penuh. */
    fun gallery(urls: List<String>, start: Int, title: String, caption: String) {
        val list = urls.filter { it.isNotEmpty() }
        if (list.isNotEmpty()) push(Route.Gallery(list, start.coerceIn(0, list.lastIndex), title, caption))
    }

    /** Ketuk tab: pindah tab; ketuk tab yang sedang aktif = kembali ke akar tab (seperti iPhone). */
    fun select(index: Int) {
        if (index == current) {
            if (stacks[index].isNotEmpty()) {
                Motion.lastNav = System.currentTimeMillis()
                stacks[index].clear()
            }
        } else tab = index
    }

    /** Buat tagihan QRIS. Harga & status ditentukan server. */
    suspend fun checkout(plan: String, target: String = ""): JSONObject = StreamApi.request(
        "/checkout",
        "POST",
        JSONObject().put("plan", plan).put("target", target).put("request_id", UUID.randomUUID().toString()),
    )
}

val LocalNav = staticCompositionLocalOf { StreamNav() }

/** Tab bar: label + ikon garis Stream, dirender oleh `LiquidTabs` 2.6.1. */
private val TAB_ITEMS = listOf(
    TabItem("Beranda", StreamIcons.Home),
    TabItem("Live", StreamIcons.Live),
    TabItem("Theater", StreamIcons.Theater),
    TabItem("Replay", StreamIcons.Replay),
    TabItem("Akun", StreamIcons.Person),
)

// ---------------------------------------------------------------- Akar

/** Pintu masuk: pengenalan (sekali), masuk/daftar, lalu aplikasi. */
@Composable
fun StreamRoot() {
    val dark = isDarkTheme()
    var intro by rememberSaveable { mutableStateOf(!StreamApi.onboarded) }
    val signedIn = StreamApi.token.isNotEmpty()
    AppTheme(dark) {
        SystemBarIcons(light = dark || intro || !signedIn)
        val ambient = rememberLayerBackdrop()
        Box(Modifier.fillMaxSize().background(LocalColors.current.bg)) {
            Ambient(Modifier.fillMaxSize().layerBackdrop(ambient))
            CompositionLocalProvider(LocalBackdrop provides ambient) {
                AnimatedContent(
                    targetState = when {
                        intro -> 0
                        !signedIn -> 1
                        else -> 2
                    },
                    transitionSpec = { fadeIn(tween(280)) togetherWith fadeOut(tween(200)) },
                    label = "gate",
                ) { gate ->
                    when (gate) {
                        0 -> Onboarding {
                            StreamApi.onboarded = true
                            intro = false
                        }
                        1 -> AuthScreen()
                        else -> StreamApp()
                    }
                }
            }
        }
    }
}

/** Warna ikon status & navigasi bar: putih di layar merah/gelap, gelap di tema terang. */
@Composable
private fun SystemBarIcons(light: Boolean) {
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = !light
            isAppearanceLightNavigationBars = !light
        }
    }
}

private data class PageKey(val tab: Int, val depth: Int, val route: Route?)

/**
 * Aplikasi: halaman per tab dengan tumpukan sendiri (model navigasi iPhone), bilah siaran kaca di atas
 * (logo, pil ON AIR kaca merah, tombol kisi kaca), dock kaca mengambang di bawah (item aktif melebar jadi
 * tombol liquid glass merah berlabel), dan menu kaca. Kaca di atas membiaskan latar ambient + isi halaman.
 * `nav` bisa diberikan dari luar (tangkapan layar).
 */
@Composable
internal fun StreamApp(nav: StreamNav = remember { StreamNav() }) {
    val c = LocalColors.current
    val context = LocalContext.current
    val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    var update by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(Unit) {
        runCatching { StreamApi.request("/update") }.onSuccess { if (it.optInt("code") > BuildConfig.VERSION_CODE) update = it }
        delay(1200)
        if (Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        while (true) {
            runCatching { StreamNotifications.reconcile(context) }
            delay(15_000)
        }
    }
    val live = rememberFeed("live", nav.reload, pollMs = 30_000L) { "/live" }
    val top = nav.top
    SystemBarIcons(light = c.dark || top is Route.Pay || top is Route.Gallery)

    val status = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    // Bilah atas setinggi 56dp; isi mulai di bawahnya. Bawah: ruang dock.
    val insets = PaddingValues(top = status + 56.dp, bottom = navBar + 100.dp)
    BackHandler(enabled = nav.menuOpen || nav.top != null || nav.tab != 0) {
        when {
            nav.menuOpen -> nav.menuOpen = false
            nav.pop() -> Unit
            else -> nav.tab = 0
        }
    }

    // Dua lapis backdrop (pola 2.6.1): latar ambient untuk kaca di dalam halaman, lalu ambient + isi halaman
    // untuk kaca yang mengapung di atasnya (bilah atas, dock, menu).
    val ambient = LocalBackdrop.current
    val content = rememberLayerBackdrop()
    val overlay = rememberCombinedBackdrop(ambient, content)
    // Posisi gulir akar tiap tab: tepi atas memudar setelah isi tergulir.
    val offsets = remember { mutableStateMapOf<Int, Float>() }
    val scrollWatcher = remember {
        object : NestedScrollConnection {
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (nav.top == null) offsets[nav.tab] = ((offsets[nav.tab] ?: 0f) - consumed.y).coerceAtLeast(0f)
                return Offset.Zero
            }
        }
    }
    val compactPx = with(LocalDensity.current) { 24.dp.toPx() }

    CompositionLocalProvider(LocalNav provides nav, LocalInsets provides insets) {
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().layerBackdrop(content)) {
                Pages(nav, Modifier.nestedScroll(scrollWatcher))
            }
            if (top !is Route.Gallery) {
                // Selama video tampil, kaca hanya membiaskan latar ambient (diam) supaya video tidak tersendat.
                CompositionLocalProvider(LocalBackdrop provides if (PlayerPresence.count > 0) ambient else overlay) {
                    if (top !is Route.Pay) TopScrim(status + 64.dp, top != null || (offsets[nav.tab] ?: 0f) > compactPx)
                    TopBar(top, live.rows.size, Modifier.align(Alignment.TopCenter).padding(top = status))
                    AnimatedVisibility(
                        visible = top !is Route.Watch && top !is Route.Pay,
                        modifier = Modifier.align(Alignment.BottomCenter),
                        enter = fadeIn(tween(200)) + slideInVertically(tween(260)) { it / 2 },
                        exit = fadeOut(tween(160)) + slideOutVertically(tween(220)) { it / 2 },
                    ) {
                        // Tab bar liquid glass 2.6.1 (Interactive Glass Bottom Bar dari Backdrop): pil kaca bisa diseret
                        // dengan pegas teredam, meregang sesuai kecepatan, dan ikon di bawahnya merah lewat lensa.
                        LiquidTabs(
                            items = TAB_ITEMS,
                            selectedIndex = nav.tab,
                            onSelected = { nav.select(it) },
                            height = 62.dp,
                            modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = navBar + 12.dp).widthIn(max = 520.dp).fillMaxWidth(),
                        )
                    }
                    MenuPopover(nav, status)
                }
            }
            update?.let { UpdateDialog(it) { update = null } }
        }
    }
}

/** Isi: akar tab atau halaman teratas. Push/pop bergeser horizontal seperti iPhone; ganti tab & galeri memudar. */
@Composable
private fun Pages(nav: StreamNav, modifier: Modifier) {
    AnimatedContent(
        targetState = PageKey(nav.tab, nav.stacks[nav.tab].size, nav.top),
        modifier = modifier.fillMaxSize(),
        transitionSpec = {
            when {
                initialState.tab != targetState.tab -> fadeIn(tween(220)) togetherWith fadeOut(tween(160))
                targetState.route is Route.Gallery || initialState.route is Route.Gallery ->
                    (fadeIn(tween(220)) + scaleIn(tween(260), 0.94f)) togetherWith fadeOut(tween(180))
                targetState.depth > initialState.depth ->
                    slideInHorizontally(tween(340, easing = FastOutSlowInEasing)) { it } togetherWith
                        (slideOutHorizontally(tween(340, easing = FastOutSlowInEasing)) { -it / 3 } + fadeOut(tween(220)))
                else ->
                    (slideInHorizontally(tween(320, easing = FastOutSlowInEasing)) { -it / 3 } + fadeIn(tween(260))) togetherWith
                        slideOutHorizontally(tween(320, easing = FastOutSlowInEasing)) { it }
            }
        },
        label = "pages",
    ) { key ->
        when (val r = key.route) {
            null -> when (key.tab) {
                0 -> HomeScreen()
                1 -> LiveScreen()
                2 -> TheaterScreen()
                3 -> ReplayScreen()
                else -> AccountScreen()
            }
            is Route.Theater -> TheaterDetailScreen(r.item)
            is Route.Recent -> RecentDetailScreen(r.item)
            is Route.Watch -> PlayerScreen(r.item)
            is Route.Pay -> PayScreen(r.payment)
            is Route.Gallery -> ImageViewer(r.urls, r.start, r.title, r.caption)
        }
    }
}

/**
 * Bilah siaran kaca. Akar tab: logo piksel + wordmark, pil liquid glass merah "ON AIR · n" (ke tab Live),
 * tombol kisi kaca. Halaman detail: tombol kembali kaca bulat + judul condensed + tombol kisi.
 */
@Composable
private fun TopBar(top: Route?, liveCount: Int, modifier: Modifier) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val onRed = top is Route.Pay
    val fg = if (onRed) Color.White else c.ink
    Row(
        modifier.widthIn(max = 600.dp).fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (top == null) {
            PixelLogo(22.dp)
            Gap(10.dp)
            Column(Modifier.weight(1f)) {
                Txt("JKT48CONNECT", AppText.display(19.sp, fg), maxLines = 1)
                Micro("Stream", color = c.brand, size = 9f)
            }
            AnimatedVisibility(liveCount > 0, enter = fadeIn() + scaleIn(), exit = fadeOut() + scaleOut()) {
                LiquidButton(
                    onClick = { nav.tab = 1 },
                    modifier = Modifier.padding(end = 10.dp).height(40.dp),
                    tint = c.brand,
                    contentPadding = PaddingValues(horizontal = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    LiveDot(Color.White)
                    Txt("ON AIR · $liveCount", AppText.micro(Color.White, 10.sp), maxLines = 1)
                }
            }
        } else {
            LiquidIconButton(
                StreamIcons.Back, { nav.pop() }, size = 44.dp, iconSize = 20.dp, iconColor = fg,
                fill = if (onRed) Color.White.copy(alpha = 0.16f) else clearGlassFill(), contentDescription = "Kembali",
            )
            Gap(12.dp)
            Txt(top.title.uppercase(), AppText.display(22.sp, fg), Modifier.weight(1f), maxLines = 1)
            Gap(10.dp)
        }
        LiquidIconButton(
            StreamIcons.Grid, { nav.menuOpen = true }, size = 44.dp, iconSize = 20.dp, iconColor = if (onRed) Color.White else c.brand,
            fill = if (onRed) Color.White.copy(alpha = 0.16f) else clearGlassFill(), contentDescription = "Menu",
        )
    }
}

/** Tepi atas yang memudar supaya isi yang tergulir tidak bertabrakan dengan bilah. */
@Composable
private fun TopScrim(height: Dp, visible: Boolean) {
    val c = LocalColors.current
    val a by animateFloatAsState(if (visible) 1f else 0f, tween(200), label = "scrim")
    Box(
        Modifier.fillMaxWidth().height(height).graphicsLayer { alpha = a }
            .background(Brush.verticalGradient(0f to c.bg.copy(alpha = 0.92f), 0.6f to c.bg.copy(alpha = 0.7f), 1f to c.bg.copy(alpha = 0f))),
    )
}

/**
 * Menu kisi: panel kaca yang mekar dari tombol kisi di kanan atas. Kaca di atas kaca: panel mengekspor
 * backdrop-nya sendiri, tiap baris adalah tombol liquid glass yang membiaskan panel. Ketuk di luar untuk menutup.
 */
@Composable
private fun MenuPopover(nav: StreamNav, status: Dp) {
    val c = LocalColors.current
    val backdrop = LocalBackdrop.current
    val scope = rememberCoroutineScope()
    AnimatedVisibility(nav.menuOpen, enter = fadeIn(tween(160)), exit = fadeOut(tween(160))) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = if (c.dark) 0.25f else 0.08f)).clickable(interactionSource = null, indication = null) { nav.menuOpen = false })
    }
    Box(Modifier.fillMaxSize().padding(top = status + 58.dp, end = 12.dp), contentAlignment = Alignment.TopEnd) {
        AnimatedVisibility(
            nav.menuOpen,
            enter = scaleIn(spring(0.72f, 420f), initialScale = 0.3f, transformOrigin = TransformOrigin(1f, 0f)) + fadeIn(tween(120)),
            exit = scaleOut(tween(160), targetScale = 0.6f, transformOrigin = TransformOrigin(1f, 0f)) + fadeOut(tween(140)),
        ) {
            val panel = rememberLayerBackdrop()
            Column(
                Modifier
                    .width(268.dp)
                    .glass(backdrop, RoundedRectangle(28.dp), if (c.dark) Color(0xFF211A1D).copy(alpha = 0.6f) else Color.White.copy(alpha = 0.55f), blur = 4.dp, lensHeight = 18.dp, lensAmount = 28.dp, exportedBackdrop = panel)
                    .clickable(interactionSource = null, indication = null) {}
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(Modifier.padding(10.dp, 6.dp, 10.dp, 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    PixelLogo(16.dp)
                    Gap(8.dp)
                    Micro("JKT48Connect · Stream", size = 9.5f)
                }
                fun go(tab: Int) {
                    nav.menuOpen = false
                    nav.stacks[tab].clear()
                    nav.tab = tab
                }
                MenuRow("Akun & Stream Pass", StreamIcons.Pass, panel, tint = c.brand) { go(4) }
                MenuRow("Jadwal theater", StreamIcons.Theater, panel) { go(2) }
                MenuRow("Replay terbaru", StreamIcons.Replay, panel) { go(3) }
                MenuRow(
                    "Tema · " + when (ThemeController.mode) {
                        ThemeMode.System -> "Sistem"
                        ThemeMode.Light -> "Terang"
                        ThemeMode.Dark -> "Gelap"
                    },
                    StreamIcons.Moon,
                    panel,
                ) { ThemeController.set(ThemeMode.entries[(ThemeController.mode.ordinal + 1) % ThemeMode.entries.size]) }
                MenuRow("Keluar akun", StreamIcons.Logout, panel) {
                    nav.menuOpen = false
                    scope.launch { runCatching { StreamApi.logout() } }
                }
            }
        }
    }
}

@Composable
private fun MenuRow(label: String, icon: ImageVector, backdrop: Backdrop, tint: Color = Color.Unspecified, onClick: () -> Unit) {
    val c = LocalColors.current
    val fg = if (tint.isSpecified) Color.White else c.ink
    LiquidButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        backdrop = backdrop,
        shape = RoundedRectangle(18.dp),
        tint = tint,
        contentPadding = PaddingValues(horizontal = 14.dp),
        horizontalArrangement = Arrangement.Start,
    ) {
        Image(icon, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(if (tint.isSpecified) Color.White else c.brand))
        Spacer(Modifier.width(12.dp))
        Txt(label, AppText.body(15.sp, fg, 700), maxLines = 1)
    }
}

/** Pop-up versi baru: nomor versi besar, catatan rilis, unduh atau nanti. */
@Composable
private fun UpdateDialog(data: JSONObject, onDismiss: () -> Unit) {
    val c = LocalColors.current
    val open = rememberOpenUrl()
    Dialog(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(30.dp)).background(c.card).padding(22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PixelLogo(20.dp)
                Gap(10.dp)
                Micro("Versi baru tersedia", color = c.brand)
            }
            VGap(10.dp)
            Txt("STREAM ${data.optString("version")}", AppText.display(34.sp, c.ink))
            VGap(8.dp)
            Txt(data.optString("notes"), AppText.body(14.sp, c.ink, 500, 1.45f))
            VGap(18.dp)
            Box(
                Modifier.fillMaxWidth().height(52.dp).clip(CircleShape).background(c.brandGradient).pressable({ open(data.optString("apk")) }),
                contentAlignment = Alignment.Center,
            ) { Txt("Unduh pembaruan", AppText.body(15.sp, Color.White, 800)) }
            VGap(8.dp)
            Box(Modifier.fillMaxWidth().height(46.dp).pressable(onDismiss), contentAlignment = Alignment.Center) {
                Txt("Nanti", AppText.body(15.sp, c.inkSoft, 700))
            }
        }
    }
}
