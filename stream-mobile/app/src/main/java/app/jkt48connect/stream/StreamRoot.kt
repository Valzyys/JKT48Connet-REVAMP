package app.jkt48connect.stream

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import app.jkt48connect.stream.ui.components.Ambient
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.backdrop.backdrops.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

private val tabs = listOf(
    TabItem("Beranda", StreamIcons.Home),
    TabItem("Live", StreamIcons.Sensors),
    TabItem("Panggung", StreamIcons.TheaterComedy),
    TabItem("Replay", StreamIcons.History),
    TabItem("Akun", StreamIcons.Person),
)

private const val TAB_ACCOUNT = 4

@Composable fun StreamRoot() {
    var intro by rememberSaveable { mutableStateOf(!StreamApi.onboarded) }
    val dark = isDarkTheme()
    AppTheme(dark) {
        val ambient = rememberLayerBackdrop()
        Box(Modifier.fillMaxSize().background(LocalColors.current.bg)) {
            Ambient(Modifier.fillMaxSize().layerBackdrop(ambient))
            CompositionLocalProvider(LocalBackdrop provides ambient) {
                AnimatedContent(if (intro) "intro" else if (StreamApi.token.isEmpty()) "auth" else "home", transitionSpec = {
                    (fadeIn(tween(220)) + slideInHorizontally(tween(330)) { it / 10 }).togetherWith(fadeOut(tween(160)))
                }, label = "entry") { route ->
                    when (route) {
                        "intro" -> Onboarding { StreamApi.onboarded = true; intro = false }
                        "auth" -> Auth()
                        else -> StreamHome()
                    }
                }
            }
        }
    }
}

@Composable private fun StreamHome() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf<JSONObject?>(null) }
    var payment by remember { mutableStateOf<JSONObject?>(null) }
    var play by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }
    var update by remember { mutableStateOf<JSONObject?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) ask.launch(Manifest.permission.POST_NOTIFICATIONS)
        runCatching { StreamApi.request("/me") }
        runCatching { StreamApi.request("/update") }.onSuccess { if (it.optInt("code") > BuildConfig.VERSION_CODE) update = it }
        while (true) {
            runCatching { StreamNotifications.reconcile(context) }
            delay(15_000)
        }
    }

    val overlay = selected != null || payment != null || play != null
    fun back() {
        error = ""
        when {
            play != null -> play = null
            payment != null -> payment = null
            else -> selected = null
        }
    }
    BackHandler(overlay) { back() }

    fun checkout(plan: String, target: String = "") {
        if (busy) return
        busy = true; error = ""
        scope.launch {
            runCatching { StreamApi.request("/checkout", "POST", JSONObject().put("plan", plan).put("target", target).put("request_id", UUID.randomUUID().toString())) }
                .onSuccess { payment = it }
                .onFailure { error = it.message.orEmpty() }
            busy = false
        }
    }

    fun watch(item: JSONObject) {
        if (busy) return
        busy = true; error = ""
        scope.launch {
            runCatching { StreamApi.request("/playback/${item.getString("kind")}/${Uri.encode(item.getString("id"))}", "POST") }
                .onSuccess { play = it }
                .onFailure { error = it.message.orEmpty() }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().systemBarsPadding()) {
        TopBar(overlay, onBack = { back() }, onAccount = { selected = null; payment = null; play = null; tab = TAB_ACCOUNT })
        if (error.isNotEmpty()) {
            Label(error, 13, color = LocalColors.current.brand, modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp))
        }
        Box(Modifier.weight(1f)) {
            AnimatedContent(
                when {
                    play != null -> "play"
                    payment != null -> "pay"
                    selected != null -> "detail"
                    else -> "tab$tab"
                },
                transitionSpec = { (fadeIn(tween(180)) + slideInHorizontally(tween(240)) { it / 14 }).togetherWith(fadeOut(tween(120))) },
                label = "pages",
            ) { route ->
                when (route) {
                    "play" -> play?.let { PlayerPage(it, selected) }
                    "pay" -> payment?.let { PayPage(it) { payment = null; selected = null; tab = TAB_ACCOUNT; reload++ } }
                    "detail" -> selected?.let { item ->
                        DetailScreen(
                            item = item,
                            busy = busy,
                            watch = { watch(item) },
                            buy = { checkout("show", item.getString("id")) },
                            chat = { play = JSONObject().put("kind", "chat").put("title", item.optString("title")).put("id", item.getString("id")) },
                        )
                    }
                    else -> when (tab) {
                        0 -> HomeScreen(reload, busy, refresh = { reload++ }, open = { selected = it; error = "" }, watch = { watch(it) }, goTab = { tab = it; error = "" })
                        1 -> LiveScreen(reload, busy, refresh = { reload++ }, open = { selected = it; error = "" }, watch = { watch(it) })
                        2 -> TheaterScreen(reload, refresh = { reload++ }, open = { selected = it; error = "" })
                        3 -> ReplayScreen(reload, refresh = { reload++ }, open = { selected = it; error = "" })
                        else -> AccountScreen(reload, busy, buy = { checkout(it) }, showPayment = { payment = it })
                    }
                }
            }
        }
        if (!overlay) {
            LiquidTabs(tabs, tab, { tab = it; error = "" }, Modifier.padding(horizontal = 12.dp, vertical = 8.dp).fillMaxWidth())
        }
    }

    update?.let { data ->
        Dialog(onDismissRequest = { update = null }) {
            GlassCard(padding = 22.dp) {
                Micro("Versi baru")
                Label(data.optString("version"), 28, true)
                Label(data.optString("notes"), 15)
                ActionButton("Unduh pembaruan", primary = true) {
                    val url = data.optString("apk")
                    if (url.startsWith("https://")) context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                }
                ActionButton("Nanti") { update = null }
            }
        }
    }
}

@Composable private fun TopBar(overlay: Boolean, onBack: () -> Unit, onAccount: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (overlay) LiquidIconButton(StreamIcons.Back, onBack, size = 44.dp, contentDescription = "Kembali")
        else Mark(40.dp)
        Column(Modifier.weight(1f)) {
            Label("JKT48Connect", 17, true)
            Micro("Stream")
        }
        LiquidIconButton(StreamIcons.Person, onAccount, size = 44.dp, contentDescription = "Akun")
    }
}
