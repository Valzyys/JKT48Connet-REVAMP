package app.jkt48connect.stream

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
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
import app.jkt48connect.stream.ui.theme.*
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

private data class Plan(val id: String, val name: String, val price: Long, val days: Int, val note: String)

private val PLANS = listOf(
    Plan("weekly", "Mingguan", 10_000, 7, "Coba dulu seminggu"),
    Plan("monthly", "Bulanan", 20_000, 30, "Paling pas untuk fans aktif"),
    Plan("yearly", "Tahunan", 120_000, 365, "Setahun penuh, paling hemat"),
)

/** Warna titik/pil untuk status pembayaran. */
private fun statusLabel(status: String): Pair<String, Color> = when (status.lowercase()) {
    "paid", "success", "settled" -> "Lunas" to Color(0xFF2FA35A)
    "pending", "creating" -> "Menunggu" to Color(0xFFE8A317)
    "expired" -> "Kedaluwarsa" to Color(0xFF9E9E9E)
    else -> status.replaceFirstChar { it.uppercase() }.ifEmpty { "–" } to Color(0xFF9E9E9E)
}

/**
 * Tab Akun (seperti halaman Pengaturan iPhone): kartu profil, status Stream Pass, pilihan paket,
 * riwayat pembayaran, tampilan, dan keluar.
 */
@Composable
fun AccountScreen() {
    val nav = LocalNav.current
    val c = LocalColors.current
    val me = rememberDoc("/me", nav.reload)
    val payments = rememberFeed("payments", nav.reload) { "/payments" }
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    val until = passUntil(me.data)

    fun buy(plan: String) {
        if (busy.isNotEmpty()) return
        busy = plan
        error = ""
        scope.launch {
            runCatching { nav.checkout(plan) }
                .onSuccess { nav.push(Route.Pay(it)) }
                .onFailure { error = it.message.orEmpty() }
            busy = ""
        }
    }

    PullRefresh(onRefresh = { coroutineScope { listOf(async { me.refresh() }, async { payments.refresh() }).awaitAll() } }) {
        LazyColumn(contentPadding = LocalInsets.current) {
            item { PageHeader("04", "Akun", "Profil · Stream Pass") }
            item { ProfileCard(me.data, Modifier.padding(horizontal = 16.dp).staggerIn(0)) }
            if (until != null) item { ActivePass(until, Modifier.padding(16.dp, 12.dp, 16.dp, 0.dp).staggerIn(1)) }
            if (me.error.isNotEmpty() && me.data == null) item { ErrorRetry(me.error, { nav.reload++ }) }

            item { SectionHead("Semua theater · QRIS", if (until != null) "Perpanjang Pass" else "Stream Pass") }
            PLANS.forEachIndexed { i, plan ->
                item { PlanCard(plan, busy == plan.id, Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).staggerIn(i + 2)) { buy(plan.id) } }
            }
            item {
                if (error.isNotEmpty()) Txt(error, AppText.body(13.sp, c.brand), Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
                Txt(
                    "Live dan replay member terbuka untuk semua akun. Pass membuka semua theater selama masa aktif; tiket satu show Rp4.000 bisa dibeli dari halaman theater.",
                    AppText.body(12.5.sp, c.inkSoft, 500, 1.45f),
                    Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
                )
            }

            if (payments.rows.isNotEmpty()) {
                item { SectionHead("Tagihan & tiket", "Pembayaran") }
                item {
                    InsetGroup {
                        payments.rows.take(10).forEachIndexed { i, p ->
                            if (i > 0) GroupDivider(58.dp)
                            val (label, color) = statusLabel(p.optString("status"))
                            GroupRow(
                                title = planName(p.optString("plan")),
                                subtitle = listOf(rupiah(p.optLong("total")), fmtWib(p.optString("date"), "d MMM yyyy")).filter { it.isNotEmpty() }.joinToString(" · "),
                                leading = { RowIcon(StreamIcons.Receipt, color) },
                                trailing = { Pill(label, color.copy(alpha = 0.14f), color) },
                                chevron = true,
                                onClick = { nav.push(Route.Pay(p)) },
                            )
                        }
                    }
                }
            }

            item { SectionHead("Pengaturan", "Tampilan") }
            item {
                Segmented(listOf("Sistem", "Terang", "Gelap"), ThemeController.mode.ordinal, { ThemeController.set(ThemeMode.entries[it]) })
                VGap(14.dp)
            }
            item {
                InsetGroup {
                    GroupRow(
                        title = "Versi aplikasi",
                        leading = { RowIcon(StreamIcons.Play, Color(0xFF1D1517)) },
                        trailing = { Txt("Stream ${BuildConfig.VERSION_NAME}", AppText.mono(12.sp, c.inkSoft)) },
                    )
                    GroupDivider(58.dp)
                    GroupRow(
                        title = "Keluar akun",
                        titleColor = c.brand,
                        leading = { RowIcon(StreamIcons.Logout, c.brand) },
                        onClick = { scope.launch { runCatching { StreamApi.logout() } } },
                    )
                }
            }
            item {
                Column(Modifier.fillMaxWidth().padding(top = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PixelLogo(18.dp)
                    VGap(10.dp)
                    Txt("JKT48Connect adalah layanan komunitas independen", AppText.mono(10.5.sp, c.inkSoft))
                }
            }
        }
    }
}

/** Kartu profil: avatar bulat (foto atau inisial di atas gradien merah), nama, email, status. */
@Composable
private fun ProfileCard(me: JSONObject?, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    val name = me?.optString("name").orEmpty().ifEmpty { "Penonton" }
    Row(modifier.fillMaxWidth().glassCard(26.dp).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(c.brandGradient), contentAlignment = Alignment.Center) {
            Txt(name.take(1).uppercase(), AppText.display(30.sp, Color.White))
            val avatar = me?.optString("avatar").orEmpty()
            if (avatar.startsWith("https://")) Picture(avatar, Modifier.fillMaxSize())
        }
        Gap(14.dp)
        Column(Modifier.weight(1f)) {
            if (me == null) {
                Skeleton(Modifier.size(140.dp, 18.dp), 6.dp)
                VGap(6.dp)
                Skeleton(Modifier.size(180.dp, 12.dp), 6.dp)
            } else {
                Txt(name, AppText.body(20.sp, c.ink, 800), maxLines = 1)
                VGap(2.dp)
                Txt(me.optString("email"), AppText.mono(11.5.sp, c.inkSoft), maxLines = 1)
                VGap(8.dp)
                if (passUntil(me) != null) Pill("Pass aktif", c.brand, Color.White) else Pill("Akun gratis", c.surface, c.inkSoft)
            }
        }
    }
}

/** Pass aktif: kartu merah dengan sisa hari besar. */
@Composable
private fun ActivePass(until: Long, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    val days = ((until * 1000 - System.currentTimeMillis()) / 86_400_000L).coerceAtLeast(0)
    Box(
        modifier
            .shadow(20.dp, RoundedCornerShape(28.dp), ambientColor = c.brand, spotColor = c.brand)
            .clip(RoundedCornerShape(28.dp))
            .background(c.brandGradient)
            .fillMaxWidth(),
    ) {
        PixelLogo(150.dp, Modifier.align(Alignment.TopEnd).offset(40.dp, (-30).dp).graphicsLayer { rotationZ = 18f; alpha = 0.13f }, color = Color.White)
        Column(Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(StreamIcons.Pass, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(Color.White))
                Gap(8.dp)
                Micro("Stream Pass aktif", color = Color.White.copy(alpha = 0.85f))
            }
            VGap(12.dp)
            Txt("$days HARI", AppText.display(44.sp, Color.White))
            Txt("LAGI", AppText.display(44.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
            VGap(8.dp)
            Txt("Berlaku sampai ${fmtWib(Instant.ofEpochSecond(until).toString(), "EEEE, d MMMM yyyy")}", AppText.mono(11.5.sp, Color.White.copy(alpha = 0.8f)))
        }
    }
}

/** Satu paket Pass. Paket bulanan disorot merah. */
@Composable
private fun PlanCard(plan: Plan, busy: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val hot = plan.id == "monthly"
    val fg = if (hot) Color.White else c.ink
    val soft = if (hot) Color.White.copy(alpha = 0.75f) else c.inkSoft
    Row(
        modifier
            .fillMaxWidth()
            .pressable(onClick)
            .then(if (hot) Modifier.clip(RoundedCornerShape(24.dp)).background(c.brandGradient) else Modifier.glassCard(24.dp))
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Micro("${plan.days} hari", color = soft)
                if (hot) {
                    Gap(8.dp)
                    Pill("Favorit", Color.White, c.brand)
                }
            }
            VGap(4.dp)
            Txt(plan.name.uppercase(), AppText.display(28.sp, fg))
            Txt(plan.note, AppText.body(13.sp, soft), maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End) {
            Txt(rupiah(plan.price), AppText.display(24.sp, fg))
            VGap(8.dp)
            Box(Modifier.background(if (hot) Color.White else c.brand, CircleShape).padding(horizontal = 14.dp, vertical = 7.dp)) {
                if (busy) Spinner(14.dp, if (hot) c.brand else Color.White)
                else Txt("Pilih", AppText.body(13.sp, if (hot) c.brand else Color.White, 800))
            }
        }
    }
}
