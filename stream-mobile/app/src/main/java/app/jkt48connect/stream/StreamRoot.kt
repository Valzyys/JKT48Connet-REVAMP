package app.jkt48connect.stream

import android.Manifest
import android.os.Build
import android.graphics.Bitmap
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import app.jkt48connect.stream.ui.components.Ambient
import com.kyant.backdrop.backdrops.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun displayDate(value: String): String = runCatching { DateTimeFormatter.ofPattern("d MMM yyyy · HH.mm 'WIB'", Locale("id", "ID")).withZone(ZoneId.of("Asia/Jakarta")).format(Instant.parse(value)) }.getOrDefault(value)

private fun JSONArray.rows() = (0 until length()).mapNotNull { optJSONObject(it) }
private val tabs = listOf(TabItem("Panggung", StreamIcons.TheaterComedy), TabItem("Live", StreamIcons.Sensors), TabItem("Replay", StreamIcons.History), TabItem("Akun", StreamIcons.Person))

@Composable private fun Label(text: String, size: Int = 15, strong: Boolean = false, color: Color = LocalColors.current.ink, modifier: Modifier = Modifier) {
    BasicText(text, modifier, style = if (strong) AppText.title(size.sp, color) else AppText.body(size.sp, color))
}
@Composable private fun Micro(text: String, color: Color = LocalColors.current.inkSoft) { BasicText(text, style = AppText.micro(color, 10.sp)) }
@Composable private fun Mark(modifier: Modifier = Modifier) {
    Box(modifier.size(52.dp).glass(LocalBackdrop.current, RoundedCornerShape(17.dp), Color(0xFFE52740).copy(alpha = .72f)), contentAlignment = Alignment.Center) {
        Image(StreamIcons.PlayArrow, "JKT48Connect Stream", Modifier.size(34.dp), colorFilter = ColorFilter.tint(Color.White))
    }
}
@Composable private fun Pane(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().glass(LocalBackdrop.current, RoundedCornerShape(28.dp), glassFill(), blur = 3.dp).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
}
@Composable private fun Action(text: String, primary: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    LiquidButton(onClick, modifier.height(52.dp), tint = if (primary) LocalColors.current.brand else Color.Unspecified) {
        Label(text, 15, true, if (primary) Color.White else LocalColors.current.ink)
    }
}
@Composable private fun Field(label: String, value: String, password: Boolean = false, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Micro(label.uppercase())
        BasicTextField(value, onChange, Modifier.fillMaxWidth().glass(LocalBackdrop.current, RoundedCornerShape(16.dp), glassFill()).padding(16.dp),
            singleLine = true, textStyle = AppText.body(16.sp, LocalColors.current.ink), cursorBrush = SolidColor(LocalColors.current.brand),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None)
    }
}
@Composable private fun Picture(url: String, modifier: Modifier = Modifier) {
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(url) { if (url.isNotEmpty()) runCatching { StreamApi.bitmap(url) }.onSuccess { bitmap = it } }
    Box(modifier.background(LocalColors.current.surface)) {
        bitmap?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        if (bitmap == null) Image(StreamIcons.TheaterComedy, null, Modifier.size(56.dp).align(Alignment.Center), colorFilter = ColorFilter.tint(LocalColors.current.inkSoft))
    }
}

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

@Composable private fun Onboarding(done: () -> Unit) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    val titles = listOf("Panggungnya dekat.\nCeritanya ikut.", "Satu tempat.\nBanyak momen.", "Masuk, lalu\nambil tempatmu.")
    val captions = listOf("Theater, live member, dan replay dalam JKT48Connect Stream.", "Ikuti live IDN & Showroom. Putar kembali momen yang ingin kamu simpan di ingatan.", "Pakai akun lamamu atau buat akun baru. Untuk theater, pilih tiket satu show atau membership.")
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(horizontal = 26.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Mark(); Micro("STREAM / 0${step+1}") }
        Spacer(Modifier.height(10.dp))
        AnimatedContent(step, transitionSpec = { fadeIn(tween(220)).togetherWith(fadeOut(tween(160))) }, label = "intro-step") { s ->
            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Label(titles[s], 43, true)
                Box(Modifier.fillMaxWidth().height(250.dp), contentAlignment = Alignment.Center) {
                    Pane(Modifier.fillMaxWidth(.91f).graphicsLayer { rotationZ = -7f }) {
                        Micro("JKT48CONNECT / STREAM")
                        Image(if (s == 1) StreamIcons.Sensors else StreamIcons.TheaterComedy, null, Modifier.size(60.dp), colorFilter = ColorFilter.tint(LocalColors.current.brand))
                        Label(if (s == 0) "THIS IS YOUR\nFRONT ROW." else if (s == 1) "LIVE NOW.\nPLAY IT AGAIN." else "YOUR PASS.\nYOUR MOMENT.", 31, true)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Micro("IDN + SHOWROOM"); Micro("→") }
                    }
                    Box(Modifier.align(Alignment.BottomEnd).offset(y = 6.dp).glass(LocalBackdrop.current, CircleShape, glassFill()).padding(18.dp)) {
                        Label(if (s == 2) "07 / 30 / 365" else "▶  LIVE", 16, true, LocalColors.current.brand)
                    }
                }
                Label(captions[s], 17, color = LocalColors.current.inkSoft)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { repeat(3) { Box(Modifier.size(if (it == step) 26.dp else 7.dp, 7.dp).background(if (it == step) LocalColors.current.brand else LocalColors.current.line, CircleShape)) } }
        Action(if (step < 2) "Lanjut →" else "Mulai menonton →", true, Modifier.fillMaxWidth()) { if (step < 2) step++ else done() }
        Spacer(Modifier.height(18.dp))
    }
}

@Composable private fun Auth() {
    var register by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var name by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }; val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(26.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Spacer(Modifier.height(18.dp)); Mark(); Micro("JKT48CONNECT STREAM")
        Label(if (register) "Tempatmu\nsudah menunggu." else "Senang kamu\nkembali.", 42, true)
        Label("Masuk dengan akun web lamamu. Riwayat dan akses yang masih aktif ikut bersamamu.", 16, color = LocalColors.current.inkSoft)
        LiquidTabs(listOf(TabItem("Masuk"), TabItem("Daftar")), if (register) 1 else 0, { register = it == 1; error = "" }, Modifier.fillMaxWidth(), segmented = true)
        Pane {
            if (register) Field("Nama panggilan", name) { name = it }
            Field("Email", email) { email = it }
            Field("Password", password, true) { password = it }
            if (error.isNotEmpty()) Label(error, 13, color = LocalColors.current.brand)
            Action(if (busy) "Sebentar…" else if (register) "Buat akun →" else "Masuk →", true, Modifier.fillMaxWidth()) {
                if (!busy) scope.launch { busy = true; error = ""; runCatching { StreamApi.auth(email, password, name, register) }.onFailure { error = it.message.orEmpty() }; busy = false }
            }
        }
        Label("Dengan melanjutkan, kamu menyetujui ketentuan penggunaan. JKT48Connect adalah layanan komunitas independen.", 12, color = LocalColors.current.inkSoft)
    }
}

@Composable private fun StreamHome() {
    var tab by rememberSaveable { mutableIntStateOf(0) }; var selected by remember { mutableStateOf<JSONObject?>(null) }
    var payment by remember { mutableStateOf<JSONObject?>(null) }; var play by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }; var reload by remember { mutableIntStateOf(0) }
    var update by remember { mutableStateOf<JSONObject?>(null) }
    val scope = rememberCoroutineScope(); val context = LocalContext.current
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) ask.launch(Manifest.permission.POST_NOTIFICATIONS)
        runCatching { StreamApi.request("/me") }
        runCatching { StreamApi.request("/update") }.onSuccess { if (it.optInt("code") > BuildConfig.VERSION_CODE) update = it }
        while (true) { runCatching { StreamNotifications.reconcile(context) }; delay(15_000) }
    }
    BackHandler(selected != null || payment != null || play != null) { if (play != null) play = null else if (payment != null) payment = null else selected = null; error = "" }
    fun checkout(plan: String, target: String = "") {
        if (busy) return
        busy = true; error = ""
        scope.launch {
            runCatching { StreamApi.request("/checkout", "POST", JSONObject().put("plan", plan).put("target", target).put("request_id", UUID.randomUUID().toString())) }
                .onSuccess { payment = it }.onFailure { error = it.message.orEmpty() }; busy = false
        }
    }
    fun watch(item: JSONObject) {
        if (busy) return
        busy = true; error = ""
        scope.launch {
            runCatching { StreamApi.request("/playback/${item.getString("kind")}/${Uri.encode(item.getString("id"))}", "POST") }
                .onSuccess { play = it }.onFailure { error = it.message.orEmpty() }; busy = false
        }
    }
    Column(Modifier.fillMaxSize().systemBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (selected != null || payment != null || play != null) Action("‹") { if (play != null) play = null else if (payment != null) payment = null else selected = null; error = "" } else Mark(Modifier.size(38.dp))
            Column(Modifier.weight(1f)) { Label("JKT48Connect", 17, true); Micro("STREAM") }
            Action("Pass ✦") { selected = null; payment = null; play = null; tab = 3 }
        }
        if (error.isNotEmpty()) Label(error, 13, color = LocalColors.current.brand, modifier = Modifier.padding(horizontal = 22.dp, vertical = 8.dp))
        Box(Modifier.weight(1f)) {
            AnimatedContent(when { play != null -> "play"; payment != null -> "pay"; selected != null -> "detail"; else -> "tab$tab" }, transitionSpec = {
                (fadeIn(tween(180)) + slideInHorizontally(tween(240)) { it / 14 }).togetherWith(fadeOut(tween(120)))
            }, label = "pages") { route ->
                when (route) {
                    "play" -> play?.let { PlayerPage(it, selected) }
                    "pay" -> payment?.let { PayPage(it) { payment = null; selected = null; tab = 3; reload++ } }
                    "detail" -> selected?.let { item -> Detail(item, busy, { watch(item) }, { checkout("show", item.getString("id")) }, { play = JSONObject().put("kind", "chat").put("title", item.optString("title")) }) }
                    "tab3" -> AccountPage(reload, busy, { checkout(it) }, { payment = it })
                    else -> CatalogPage(tab, reload, { selected = it; error = "" }, { reload++ })
                }
            }
        }
        if (selected == null && payment == null && play == null) LiquidTabs(tabs, tab, { tab = it; error = "" }, Modifier.padding(horizontal = 14.dp, vertical = 8.dp).fillMaxWidth())
    }
    update?.let { data ->
        androidx.compose.ui.window.Dialog(onDismissRequest = { update = null }) {
            Pane { Micro("VERSI BARU"); Label(data.optString("version"), 28, true); Label(data.optString("notes"), 15)
                Action("Unduh pembaruan", true) { val url = data.optString("apk"); if (url.startsWith("https://")) context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                Action("Nanti") { update = null }
            }
        }
    }
}

@Composable private fun CatalogPage(tab: Int, reload: Int, open: (JSONObject) -> Unit, refresh: () -> Unit) {
    var rows by remember(tab) { mutableStateOf<List<JSONObject>>(emptyList()) }; var failure by remember(tab) { mutableStateOf("") }; var loading by remember(tab) { mutableStateOf(true) }; var page by remember(tab) { mutableIntStateOf(1) }
    LaunchedEffect(tab, reload, page) {
        do {
            runCatching { StreamApi.request(when (tab) { 0 -> "/catalog"; 1 -> "/live"; else -> "/recent?page=$page" }) }
                .onSuccess { val batch = it.optJSONArray("items")?.rows().orEmpty(); rows = if (page == 1) batch else (rows + batch).distinctBy { r -> r.optString("id") }; failure = "" }
                .onFailure { failure = it.message.orEmpty() }; loading = false
            if (tab != 1) break
            delay(10_000)
        } while (true)
    }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Micro(when (tab) { 0 -> "YOUR FRONT ROW"; 1 -> "ON AIR / MEMBER"; else -> "THE MOMENTS STAY" })
            Spacer(Modifier.height(8.dp)); Label(when (tab) { 0 -> "Sampai jumpa\ndi panggung."; 1 -> "Sedang bersama\noshimu."; else -> "Putar lagi\nceritanya." }, 37, true)
            Spacer(Modifier.height(10.dp)); Label(when (tab) { 0 -> "Tiket Rp4.000 per show · atau gunakan Pass."; 1 -> "IDN & Showroom, langsung di aplikasi."; else -> "Arsip live member, tanpa menunggu 72 jam." }, 14, color = LocalColors.current.inkSoft)
        }
        if (failure.isNotEmpty()) item { Pane { Label(failure, 14); Action("Coba lagi", onClick = refresh) } }
        if (loading) item { Pane { Label("Menyiapkan tempatmu…", 16) } }
        if (!loading && rows.isEmpty() && failure.isEmpty()) item { Pane { Label(if (tab == 1) "Belum ada member yang live." else "Belum ada siaran yang tersedia.", 17, true); Label("Kabar berikutnya akan muncul di sini.", 14, color = LocalColors.current.inkSoft); Action("Muat ulang", onClick = refresh) } }
        items(rows, key = { it.optString("id") }) { item ->
            Column(Modifier.fillMaxWidth().glass(LocalBackdrop.current, RoundedCornerShape(28.dp), glassFill()).clickable { open(item) }) {
                Picture(item.optString("image"), Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)))
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Micro(if (item.optBoolean("isLive")) "● LIVE SEKARANG" else item.optString("subtitle", "JKT48 THEATER").uppercase(), LocalColors.current.brand)
                    Label(item.optString("title"), 22, true)
                    Label(displayDate(item.optString("date")), 12, color = LocalColors.current.inkSoft)
                    if (tab == 0) Label(if (item.optBoolean("hasAccess")) "Aksesmu aktif  →" else "Rp4.000 / show  →", 14, true, LocalColors.current.brand)
                }
            }
        }
        if (tab == 2 && rows.isNotEmpty()) item { Action("Lihat replay berikutnya", modifier = Modifier.fillMaxWidth()) { page++ } }
    }
}

@Composable private fun Detail(item: JSONObject, busy: Boolean, watch: () -> Unit, buy: () -> Unit, chat: () -> Unit) {
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Picture(item.optString("image"), Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(28.dp))) }
        item { Micro(item.optString("kind").uppercase()); Spacer(Modifier.height(8.dp)); Label(item.optString("title"), 34, true); Spacer(Modifier.height(10.dp)); Label(displayDate(item.optString("date")), 14, color = LocalColors.current.inkSoft) }
        item { Pane {
            if (item.optString("kind") != "theater" || item.optBoolean("hasAccess")) {
                Label("Tempatmu sudah siap.", 23, true); Label(if (item.optString("kind") == "recent") "Pilih bagian rekaman di pemutar." else "Pemutar menyesuaikan kualitas secara otomatis.", 14)
                Action(if (busy) "Menyiapkan siaran…" else "▶  Buka pemutar", true, Modifier.fillMaxWidth(), watch)
                if (item.optString("kind") == "theater") Action("Obrolan penonton", modifier = Modifier.fillMaxWidth(), onClick = chat)
            } else {
                Label("Satu show. Satu tiket.", 23, true); Label("Rp4.000 untuk show ini. Sudah punya membership? Akses berlaku otomatis.", 15)
                Action(if (busy) "Menyiapkan tagihan…" else "Ambil tiket · Rp4.000", true, Modifier.fillMaxWidth(), buy)
            }
        } }
        val members = item.optJSONArray("lineup")?.rows().orEmpty()
        if (members.isNotEmpty()) {
            item { Label("Di panggung malam ini", 22, true) }
            items(members.chunked(3)) { group -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                group.forEach { m -> Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { Picture(m.optString("img"), Modifier.fillMaxWidth().aspectRatio(.8f).clip(RoundedCornerShape(20.dp))); Label(m.optString("name"), 12, true) } }
                repeat(3 - group.size) { Spacer(Modifier.weight(1f)) }
            } }
        }
    }
}

@Composable private fun AccountPage(reload: Int, busy: Boolean, buy: (String) -> Unit, showPayment: (JSONObject) -> Unit) {
    var me by remember { mutableStateOf(JSONObject()) }; var payments by remember { mutableStateOf<List<JSONObject>>(emptyList()) }; var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LaunchedEffect(reload) { runCatching { me = StreamApi.request("/me"); payments = StreamApi.request("/payments").optJSONArray("items")?.rows().orEmpty() }.onFailure { error = it.message.orEmpty() } }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Micro("YOUR STREAM PASS"); Spacer(Modifier.height(8.dp)); Label("Halo, ${me.optString("name", "kamu")}.", 35, true); Label(me.optString("email"), 14, color = LocalColors.current.inkSoft) }
        if (error.isNotEmpty()) item { Label(error, 14, color = LocalColors.current.brand) }
        item { Pane { Label(if ((me.optJSONArray("access")?.length() ?: 0) > 0) "Aksesmu aktif ✦" else "Cari tempat di depan?", 24, true); Label("Membership membuka theater selama masa aktif. Live dan replay member tetap tersedia untuk semua akun.", 15) } }
        listOf(Triple("weekly", "Mingguan", "Rp10.000 / 7 hari"), Triple("monthly", "Bulanan", "Rp20.000 / 30 hari"), Triple("yearly", "Tahunan", "Rp120.000 / 365 hari")).forEach { plan ->
            item { Pane { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Label(plan.second, 23, true); Micro(if (plan.first == "monthly") "PILIHAN BULANAN" else "STREAM PASS") }; Label(plan.third, 19); Action(if (busy) "Sebentar…" else "Pilih ${plan.second}", plan.first == "monthly", Modifier.fillMaxWidth()) { buy(plan.first) } } }
        }
        if (payments.isNotEmpty()) item { Label("Riwayat pembayaran", 23, true) }
        items(payments, key = { it.getString("id") }) { p -> Pane { Micro(p.optString("status").uppercase()); Label("Rp${p.optLong("total")} · ${p.optString("plan")}", 18, true); Action("Lihat tagihan") { showPayment(p) } } }
        item { Pane { Micro("TAMPILAN"); LiquidTabs(listOf(TabItem("Sistem"), TabItem("Terang"), TabItem("Gelap")), ThemeController.mode.ordinal, { ThemeController.set(ThemeMode.entries[it]) }, Modifier.fillMaxWidth(), segmented = true); Action("Keluar akun") { scope.launch { runCatching { StreamApi.logout() } } }; Label("JKT48Connect Stream ${BuildConfig.VERSION_NAME}", 12, color = LocalColors.current.inkSoft) } }
    }
}

@Composable private fun PayPage(initial: JSONObject, finished: () -> Unit) {
    var payment by remember(initial.optString("id")) { mutableStateOf(initial) }; var error by remember { mutableStateOf("") }
    val context = LocalContext.current
    LaunchedEffect(initial.optString("id")) {
        while (true) {
            runCatching { StreamApi.request("/payments/${initial.getString("id")}") }.onSuccess { payment = it }.onFailure { error = it.message.orEmpty() }
            if (payment.optBoolean("legacy") || payment.optString("status") !in listOf("pending", "creating")) break
            delay(4_000)
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Micro("CHECKOUT / QRIS"); Label(if (payment.optBoolean("legacy")) "Riwayat\npembayaran lama." else if (payment.optString("status") == "paid") "Kamu sudah\npunya tempat." else "Selesaikan\npembayaranmu.", 36, true)
        Pane {
            Micro("BAYAR TEPAT SESUAI NOMINAL"); Label("Rp${payment.optLong("total")}", 36, true)
            Label("Nominal sudah termasuk kode unik. Akses aktif setelah gateway mengonfirmasi pembayaran.", 14, color = LocalColors.current.inkSoft)
            if (payment.optString("status") == "pending" && !payment.optBoolean("legacy")) Picture(payment.optString("qr"), Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(20.dp)))
            Micro("STATUS / ${payment.optString("status").uppercase()}")
            if (payment.optString("expiresAt").isNotEmpty()) Label("Berlaku sampai ${displayDate(payment.optString("expiresAt"))}", 12)
            if (payment.optString("status") == "paid" && !payment.optBoolean("legacy")) Action("Buka aksesku →", true, Modifier.fillMaxWidth(), finished)
            else if (payment.optString("payUrl").startsWith("https://")) Action("Buka halaman pembayaran", modifier = Modifier.fillMaxWidth()) { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(payment.getString("payUrl")))) }
        }
        if (error.isNotEmpty()) Label(error, 13, color = LocalColors.current.brand)
        Label("Tidak perlu membiarkan aplikasi tetap terbuka. Server terus memeriksa pembayaran; status akan diperbarui saat kamu kembali.", 14, color = LocalColors.current.inkSoft)
    }
}

@Composable private fun PlayerPage(data: JSONObject, selected: JSONObject?) {
    val parts = data.optJSONArray("items")?.rows().orEmpty(); var index by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        parts.getOrNull(index)?.let { part -> NativePlayer(part.getString("url"), part.optBoolean("hls")) }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Label(data.optString("title"), 24, true)
            if (parts.size > 1) LiquidTabs(parts.map { TabItem(it.optString("label")) }, index, { index = it }, Modifier.fillMaxWidth(), segmented = true)
        }
        if (data.optString("kind") in listOf("theater", "chat") && selected != null) Chat(selected.getString("id"), Modifier.weight(1f))
    }
}

@Composable private fun NativePlayer(url: String, hls: Boolean) {
    val context = LocalContext.current
    val player = remember(url) {
        val factory = DefaultHttpDataSource.Factory().setDefaultRequestProperties(mapOf("Authorization" to "Bearer ${StreamApi.token}"))
            .setConnectTimeoutMs(15_000).setReadTimeoutMs(20_000).setAllowCrossProtocolRedirects(false)
        ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(factory)).build().apply {
            val item = MediaItem.Builder().setUri(url); if (hls) item.setMimeType(MimeTypes.APPLICATION_M3U8)
            setMediaItem(item.build()); prepare(); playWhenReady = true
        }
    }
    val lifecycle = (context as? androidx.activity.ComponentActivity)?.lifecycle
    DisposableEffect(player, lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event -> if (event == androidx.lifecycle.Lifecycle.Event.ON_PAUSE) player.pause() }
        lifecycle?.addObserver(observer)
        onDispose { lifecycle?.removeObserver(observer); player.release() }
    }
    AndroidView(factory = { PlayerView(it).apply { this.player = player; setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING); keepScreenOn = true } },
        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black), update = { it.player = player })
}

@Composable private fun Chat(room: String, modifier: Modifier = Modifier) {
    var rows by remember(room) { mutableStateOf<List<JSONObject>>(emptyList()) }; var text by remember { mutableStateOf("") }; var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LaunchedEffect(room) {
        var after = 0L
        while (true) {
            runCatching { StreamApi.request("/chat/${Uri.encode(room)}?after=$after&wait=20") }.onSuccess {
                val batch = it.optJSONArray("items")?.rows().orEmpty(); rows = (rows + batch).distinctBy { r -> r.optLong("id") }.takeLast(150)
                batch.lastOrNull()?.let { row -> after = row.optLong("id") }; error = ""
            }.onFailure { error = it.message.orEmpty(); delay(3_000) }
        }
    }
    Column(modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Micro("OBROLAN PENONTON")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp), reverseLayout = true) {
            items(rows.reversed(), key = { it.optLong("id") }) { m -> Column { Label(m.optString("name"), 12, true, LocalColors.current.brand); Label(m.optString("message"), 14) } }
        }
        if (error.isNotEmpty()) Label(error, 12, color = LocalColors.current.brand)
        Row(Modifier.imePadding().padding(bottom = 14.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { Field("Pesan", text) { text = it.take(500) } }
            Action("↑", true) { if (text.isNotBlank()) scope.launch { runCatching { StreamApi.request("/chat/${Uri.encode(room)}", "POST", JSONObject().put("message", text)) }.onSuccess { text = "" }.onFailure { error = it.message.orEmpty() } } }
        }
    }
}
