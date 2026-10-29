package app.jkt48connect.stream

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.*
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Hasil satu sumber data: daftar item, status muat, pesan galat, dan pemuatan halaman berikutnya. */
class Feed(val rows: List<JSONObject>, val loading: Boolean, val error: String, val next: () -> Unit)

/**
 * Memuat daftar dari server. Bila [pollMs] > 0, daftar diperbarui berkala (untuk live).
 * Halaman berikutnya ditambahkan ke daftar yang sudah ada (untuk replay).
 */
@Composable private fun useFeed(path: (Int) -> String, reload: Int, pollMs: Long = 0L): Feed {
    var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var page by remember { mutableIntStateOf(1) }
    LaunchedEffect(reload, page) {
        while (true) {
            runCatching { StreamApi.request(path(page)) }
                .onSuccess {
                    val batch = it.optJSONArray("items")?.rows().orEmpty()
                    rows = if (page == 1) batch else (rows + batch).distinctBy { r -> r.optString("id") }
                    error = ""
                }
                .onFailure { error = it.message.orEmpty() }
            loading = false
            if (pollMs <= 0L) break
            delay(pollMs)
        }
    }
    return Feed(rows, loading, error) { page++ }
}

@Composable private fun Empty(text: String, hint: String, refresh: () -> Unit) {
    GlassCard(Modifier.padding(horizontal = 16.dp)) {
        Label(text, 18, true)
        Label(hint, 14, color = LocalColors.current.inkSoft)
        ActionButton("Muat ulang", onClick = refresh)
    }
}

/** Kartu media untuk daftar: gambar 16:9 dengan chip LIVE dan platform, lalu judul dan tanggal. */
@Composable private fun MediaCard(item: JSONObject, footer: String, modifier: Modifier = Modifier, onOpen: () -> Unit) {
    val c = LocalColors.current
    GlassCard(modifier.clickable(onClick = onOpen), radius = 28.dp, padding = 0.dp, spacing = 0.dp) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))) {
            Picture(item.optString("image"), Modifier.fillMaxSize())
            Row(Modifier.align(Alignment.TopStart).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (item.optBoolean("isLive")) Pill("● Live", c.brand)
                val platform = item.optString("platform")
                if (platform.isNotEmpty()) Pill(platformName(platform), Color.Black.copy(alpha = .55f))
            }
        }
        Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Micro(item.optString("subtitle", "JKT48 Theater"), c.brand)
            Label(item.optString("title"), 21, true)
            if (item.optString("date").isNotEmpty()) Label(displayDate(item.optString("date")), 12, color = c.inkSoft)
            if (footer.isNotEmpty()) Label(footer, 14, true, c.brand)
        }
    }
}

/** Sorotan live teratas di beranda: besar, dengan tombol tonton langsung. */
@Composable private fun LiveHero(item: JSONObject, busy: Boolean, onOpen: () -> Unit, onWatch: () -> Unit) {
    val c = LocalColors.current
    GlassCard(padding = 0.dp, spacing = 0.dp) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).clickable(onClick = onOpen)) {
            Picture(item.optString("image"), Modifier.fillMaxSize())
            Row(Modifier.align(Alignment.TopStart).padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill("● Live", c.brand)
                Pill(platformName(item.optString("platform")), Color.Black.copy(alpha = .55f))
            }
        }
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LiveDot()
                Micro("Sedang live sekarang")
            }
            Label(item.optString("title"), 24, true)
            ActionButton(if (busy) "Menyiapkan siaran…" else "▶  Tonton di aplikasi", primary = true, onClick = onWatch)
        }
    }
}

@Composable fun HomeScreen(reload: Int, busy: Boolean, refresh: () -> Unit, open: (JSONObject) -> Unit, watch: (JSONObject) -> Unit, goTab: (Int) -> Unit) {
    val live = useFeed({ "/live" }, reload, pollMs = 10_000L)
    val theater = useFeed({ "/catalog" }, reload)
    val replay = useFeed({ "/recent?page=1" }, reload)
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { PageHeader("IDN · Showroom", "Beranda") }
        item {
            val now = live.rows.firstOrNull()
            Column(Modifier.padding(horizontal = 16.dp)) {
                if (now != null) LiveHero(now, busy, onOpen = { open(now) }, onWatch = { watch(now) })
                else Empty("Belum ada yang live.", "Kabar siaran berikutnya muncul di sini.", refresh)
            }
        }
        if (live.rows.size > 1) {
            item { SectionHead("Sedang live", "Live", onMore = { goTab(1) }) }
            items(live.rows.drop(1).take(2), key = { it.optString("id") }) { item ->
                MediaCard(item, "Tonton sekarang  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
            }
        }
        item { SectionHead("Panggung", "Theater", onMore = { goTab(2) }) }
        items(theater.rows.take(2), key = { it.optString("id") }) { item ->
            MediaCard(item, if (item.optBoolean("hasAccess")) "Aksesmu aktif  →" else "Rp4.000 / show  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
        }
        item { SectionHead("Arsip", "Replay", onMore = { goTab(3) }) }
        items(replay.rows.take(3), key = { it.optString("id") }) { item ->
            MediaCard(item, "Putar replay  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
        }
    }
}

@Composable fun LiveScreen(reload: Int, busy: Boolean, refresh: () -> Unit, open: (JSONObject) -> Unit, watch: (JSONObject) -> Unit) {
    val live = useFeed({ "/live" }, reload, pollMs = 10_000L)
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { PageHeader("Diperbarui tiap 10 detik", "Live") }
        if (live.error.isNotEmpty()) item { GlassCard(Modifier.padding(horizontal = 16.dp)) { Label(live.error, 14); ActionButton("Coba lagi", onClick = refresh) } }
        if (!live.loading && live.rows.isEmpty() && live.error.isEmpty()) {
            item { Empty("Belum ada member yang live.", "IDN dan Showroom akan muncul di sini saat mulai.", refresh) }
        }
        items(live.rows, key = { it.optString("id") }) { item ->
            MediaCard(item, if (busy) "Menyiapkan siaran…" else "Tonton di aplikasi  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
        }
    }
}

@Composable fun TheaterScreen(reload: Int, refresh: () -> Unit, open: (JSONObject) -> Unit) {
    val catalog = useFeed({ "/catalog" }, reload)
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { PageHeader("Tiket Rp4.000 per show · atau Pass", "Panggung") }
        if (catalog.error.isNotEmpty()) item { GlassCard(Modifier.padding(horizontal = 16.dp)) { Label(catalog.error, 14); ActionButton("Coba lagi", onClick = refresh) } }
        if (!catalog.loading && catalog.rows.isEmpty() && catalog.error.isEmpty()) {
            item { Empty("Belum ada siaran yang tersedia.", "Kabar berikutnya akan muncul di sini.", refresh) }
        }
        items(catalog.rows, key = { it.optString("id") }) { item ->
            MediaCard(item, if (item.optBoolean("hasAccess")) "Aksesmu aktif  →" else "Rp4.000 / show  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
        }
    }
}

@Composable fun ReplayScreen(reload: Int, refresh: () -> Unit, open: (JSONObject) -> Unit) {
    val replay = useFeed({ page -> "/recent?page=$page" }, reload)
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item { PageHeader("Rekap live member", "Replay") }
        if (replay.error.isNotEmpty()) item { GlassCard(Modifier.padding(horizontal = 16.dp)) { Label(replay.error, 14); ActionButton("Coba lagi", onClick = refresh) } }
        if (!replay.loading && replay.rows.isEmpty() && replay.error.isEmpty()) {
            item { Empty("Belum ada replay.", "Replay member muncul setelah live selesai.", refresh) }
        }
        items(replay.rows, key = { it.optString("id") }) { item ->
            MediaCard(item, "Putar replay  →", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { open(item) }
        }
        if (replay.rows.isNotEmpty()) item { ActionButton("Lihat replay berikutnya", modifier = Modifier.padding(16.dp)) { replay.next() } }
    }
}

@Composable fun DetailScreen(item: JSONObject, busy: Boolean, watch: () -> Unit, buy: () -> Unit, chat: () -> Unit) {
    val c = LocalColors.current
    val context = LocalContext.current
    val kind = item.optString("kind")
    val platform = item.optString("platform")
    val link = item.optString("link")
    val members = item.optJSONArray("lineup")?.rows().orEmpty()
    LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
        item { Picture(item.optString("image"), Modifier.fillMaxWidth().aspectRatio(16f / 9f)) }
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Micro(if (kind == "live") "Live · ${platformName(platform)}" else kind, c.brand)
                Label(item.optString("title"), 32, true)
                if (item.optString("date").isNotEmpty()) Label(displayDate(item.optString("date")), 14, color = c.inkSoft)
            }
        }
        item {
            GlassCard(Modifier.padding(horizontal = 16.dp)) {
                when {
                    kind == "live" -> {
                        Label("Siaran langsung", 22, true)
                        Label(
                            if (platform == "idn") "Diputar di aplikasi. Bila sumber IDN belum tersedia, buka di idn.app."
                            else "Diputar langsung di aplikasi.",
                            15,
                        )
                        ActionButton(if (busy) "Menyiapkan siaran…" else "▶  Tonton sekarang", primary = true, onClick = watch)
                        if (platform == "idn" && link.startsWith("https://")) {
                            ActionButton("Buka di idn.app") { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
                        }
                    }
                    kind == "recent" -> {
                        Label("Replay member", 22, true)
                        Label("Pilih bagian rekaman di pemutar.", 15)
                        ActionButton(if (busy) "Menyiapkan replay…" else "▶  Putar replay", primary = true, onClick = watch)
                    }
                    item.optBoolean("hasAccess") -> {
                        Label("Tempatmu sudah siap.", 22, true)
                        Label("Pemutar menyesuaikan kualitas secara otomatis.", 15)
                        ActionButton(if (busy) "Menyiapkan siaran…" else "▶  Buka pemutar", primary = true, onClick = watch)
                        ActionButton("Obrolan penonton", onClick = chat)
                    }
                    else -> {
                        Label("Satu show. Satu tiket.", 22, true)
                        Label("Rp4.000 untuk show ini. Sudah punya Pass? Akses berlaku otomatis.", 15)
                        ActionButton(if (busy) "Menyiapkan tagihan…" else "Ambil tiket · Rp4.000", primary = true, onClick = buy)
                    }
                }
            }
        }
        if (members.isNotEmpty()) {
            item { SectionHead("Lineup", "Di panggung") }
            items(members.chunked(3)) { group ->
                Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    group.forEach { m ->
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Picture(m.optString("img"), Modifier.fillMaxWidth().aspectRatio(.8f).clip(RoundedCornerShape(20.dp)))
                            Label(m.optString("name"), 12, true)
                        }
                    }
                    repeat(3 - group.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable fun AccountScreen(reload: Int, busy: Boolean, buy: (String) -> Unit, showPayment: (JSONObject) -> Unit) {
    var me by remember { mutableStateOf(JSONObject()) }
    var payments by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val hasPass = (me.optJSONArray("access")?.length() ?: 0) > 0
    LaunchedEffect(reload) {
        runCatching {
            me = StreamApi.request("/me")
            payments = StreamApi.request("/payments").optJSONArray("items")?.rows().orEmpty()
        }.onFailure { error = it.message.orEmpty() }
    }
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(0.dp)) {
        item { PageHeader("Stream pass", "Akun") }
        item {
            GlassCard(Modifier.padding(horizontal = 16.dp)) {
                Label("Halo, ${me.optString("name", "kamu")}.", 24, true)
                Label(me.optString("email"), 14, color = LocalColors.current.inkSoft)
                Label(if (hasPass) "Aksesmu aktif ✦" else "Belum punya Pass", 16, true, LocalColors.current.brand)
                Label("Membership membuka theater selama masa aktif. Live dan replay tetap tersedia untuk semua akun.", 14)
            }
        }
        if (error.isNotEmpty()) item { Label(error, 14, color = LocalColors.current.brand, modifier = Modifier.padding(16.dp)) }
        item { SectionHead("Pass", "Pilih paket") }
        listOf(Triple("weekly", "Mingguan", "Rp10.000 / 7 hari"), Triple("monthly", "Bulanan", "Rp20.000 / 30 hari"), Triple("yearly", "Tahunan", "Rp120.000 / 365 hari")).forEach { plan ->
            item {
                GlassCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Label(plan.second, 22, true)
                        if (plan.first == "monthly") Pill("Pilihan", LocalColors.current.brand)
                    }
                    Label(plan.third, 16)
                    ActionButton(if (busy) "Sebentar…" else "Pilih ${plan.second}", primary = plan.first == "monthly") { buy(plan.first) }
                }
            }
        }
        if (payments.isNotEmpty()) item { SectionHead("Riwayat", "Pembayaran") }
        items(payments, key = { it.optString("id") }) { p ->
            GlassCard(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                Micro(p.optString("status"))
                Label("Rp${p.optLong("total")} · ${p.optString("plan")}", 18, true)
                ActionButton("Lihat tagihan") { showPayment(p) }
            }
        }
        item {
            GlassCard(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Micro("Tampilan")
                LiquidTabs(
                    listOf(TabItem("Sistem"), TabItem("Terang"), TabItem("Gelap")),
                    ThemeController.mode.ordinal,
                    { ThemeController.set(ThemeMode.entries[it]) },
                    Modifier.fillMaxWidth(),
                    segmented = true,
                )
                ActionButton("Keluar akun") { scope.launch { runCatching { StreamApi.logout() } } }
                Label("JKT48Connect Stream ${BuildConfig.VERSION_NAME}", 12, color = LocalColors.current.inkSoft)
            }
        }
    }
}

@Composable fun PayPage(initial: JSONObject, finished: () -> Unit) {
    val c = LocalColors.current
    var payment by remember(initial.optString("id")) { mutableStateOf(initial) }
    var error by remember { mutableStateOf("") }
    val context = LocalContext.current
    LaunchedEffect(initial.optString("id")) {
        while (true) {
            runCatching { StreamApi.request("/payments/${initial.getString("id")}") }
                .onSuccess { payment = it }
                .onFailure { error = it.message.orEmpty() }
            if (payment.optBoolean("legacy") || payment.optString("status") !in listOf("pending", "creating")) break
            delay(4_000)
        }
    }
    val status = payment.optString("status")
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp)) {
        item {
            PageHeader(
                "Checkout · QRIS",
                when {
                    payment.optBoolean("legacy") -> "Riwayat lama"
                    status == "paid" -> "Sudah lunas"
                    else -> "Selesaikan bayar"
                },
            )
        }
        item {
            GlassCard(Modifier.padding(horizontal = 16.dp)) {
                Micro("Bayar tepat sesuai nominal")
                Label("Rp${payment.optLong("total")}", 36, true)
                Label("Nominal sudah termasuk kode unik. Akses aktif setelah gateway mengonfirmasi pembayaran.", 14, color = c.inkSoft)
                if (status == "pending" && !payment.optBoolean("legacy")) {
                    Picture(payment.optString("qr"), Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(20.dp)))
                }
                Micro("Status · ${status}")
                if (payment.optString("expiresAt").isNotEmpty()) Label("Berlaku sampai ${displayDate(payment.optString("expiresAt"))}", 12)
                if (status == "paid" && !payment.optBoolean("legacy")) {
                    ActionButton("Buka aksesku", primary = true, onClick = finished)
                } else if (payment.optString("payUrl").startsWith("https://")) {
                    ActionButton("Buka halaman pembayaran") { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(payment.getString("payUrl")))) }
                }
            }
        }
        if (error.isNotEmpty()) item { Label(error, 13, color = c.brand, modifier = Modifier.padding(16.dp)) }
        item {
            Label(
                "Tidak perlu membiarkan aplikasi tetap terbuka. Server terus memeriksa pembayaran; status akan diperbarui saat kamu kembali.",
                14,
                color = c.inkSoft,
                modifier = Modifier.padding(16.dp),
            )
        }
    }
}
