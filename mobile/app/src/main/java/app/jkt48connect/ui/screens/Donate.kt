package app.jkt48connect.ui.screens

import android.content.ContentValues
import android.graphics.Bitmap
import android.os.Build
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.QrCode2
import androidx.compose.material.icons.rounded.SmartToy
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.jkt48connect.core.Api
import app.jkt48connect.core.Donation
import app.jkt48connect.core.Images
import app.jkt48connect.core.timeAgo
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

private val PRESETS = listOf(5_000L, 10_000L, 20_000L, 50_000L, 100_000L, 250_000L)
private const val MIN = 1_000L
private const val MAX = 1_000_000L
private val Deep = Color(0xFF2A0610)
private val Rose = Color(0xFFFF4D7D)

private fun rupiah(n: Long) = "Rp" + String.format(Locale("in", "ID"), "%,d", n)

/** Donasi lewat QRIS (MYPG, diproses worker): pilih nominal, bayar dengan e-wallet/m-banking, muncul di dinding pendukung. */
@Composable
fun DonateScreen() {
    val c = LocalColors.current
    val scope = rememberCoroutineScope()
    val wall = rememberLoad { Api.supporters(it) }
    var preset by rememberSaveable { mutableLongStateOf(10_000L) }
    var custom by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var donation by remember { mutableStateOf<Donation?>(null) }
    var sheet by remember { mutableStateOf(false) }
    val amount = custom.filter(Char::isDigit).take(7).toLongOrNull() ?: preset
    val valid = amount in MIN..MAX
    val heroBackdrop = rememberLayerBackdrop()

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 48.dp)) {
        item {
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(32.dp)).staggerIn(0)) {
                Box(Modifier.matchParentSize().layerBackdrop(heroBackdrop)) { HeartsBackground() }
                Column(Modifier.padding(22.dp)) {
                    Box(Modifier.size(52.dp).background(Color.White.copy(alpha = 0.16f), CircleShape), contentAlignment = Alignment.Center) {
                        Image(Icons.Rounded.Favorite, null, Modifier.size(26.dp), colorFilter = ColorFilter.tint(Color.White))
                    }
                    VGap(18.dp)
                    Txt("DUKUNG", AppText.display(40.sp, Color.White))
                    Txt("JKT48CONNECT", AppText.display(40.sp, Color(0xFFFFD1DC)))
                    VGap(8.dp)
                    Txt(
                        "Aplikasi, situs, bot, dan API ini gratis tanpa iklan. Donasimu membantu biaya server dan pengembangan fitur baru.",
                        AppText.body(14.sp, Color.White.copy(alpha = 0.88f), 500, 1.5f),
                    )
                    VGap(16.dp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        HeroPill(heroBackdrop, "♥ ${wall.data?.count ?: "–"} pendukung")
                        HeroPill(heroBackdrop, "QRIS · semua e-wallet")
                    }
                }
            }
        }

        donation?.takeIf { it.status == "PENDING" && !sheet }?.let { d ->
            item {
                VGap(12.dp)
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.brand.copy(alpha = 0.12f)).pressable({ sheet = true }).padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Image(Icons.Rounded.QrCode2, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(c.brand))
                    Spacer(Modifier.width(10.dp))
                    Txt("Tagihan ${rupiah(d.amount)} menunggu pembayaran. Ketuk untuk melanjutkan.", AppText.body(13.sp, c.ink, 700), Modifier.weight(1f))
                }
            }
        }

        item { DSection("Pilih nominal", 1) }
        item {
            Column(Modifier.staggerIn(2), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PRESETS.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { v ->
                            val selected = custom.isEmpty() && preset == v
                            LiquidButton(
                                onClick = {
                                    preset = v
                                    custom = ""
                                    error = null
                                },
                                modifier = Modifier.weight(1f).height(56.dp),
                                shape = RoundedRectangle(20.dp),
                                tint = if (selected) c.brand else Color.Unspecified,
                                contentPadding = PaddingValues(horizontal = 6.dp),
                            ) {
                                Txt(if (v >= 1000) "${v / 1000}K" else "$v", AppText.display(22.sp, if (selected) Color.White else c.ink))
                            }
                        }
                    }
                }
                GlassField(
                    value = custom,
                    onValue = {
                        custom = it.filter(Char::isDigit).take(7)
                        error = null
                    },
                    prefix = "Rp",
                    hint = "Nominal lain (min. ${rupiah(MIN)})",
                    number = true,
                )
            }
        }

        item { DSection("Nama di dinding pendukung", 3) }
        item {
            GlassField(value = name, onValue = { name = it.take(24) }, prefix = "♥", hint = "Kosongkan untuk Anonim", modifier = Modifier.staggerIn(4))
        }

        item {
            VGap(18.dp)
            LiquidButton(
                onClick = {
                    if (busy) return@LiquidButton
                    if (!valid) {
                        error = "Nominal ${rupiah(MIN)}–${rupiah(MAX)}."
                        return@LiquidButton
                    }
                    busy = true
                    error = null
                    scope.launch {
                        runCatching { Api.donate(amount, name.trim()) }
                            .onSuccess {
                                donation = it
                                sheet = true
                            }
                            .onFailure { error = it.message ?: "Donasi belum bisa dibuat." }
                        busy = false
                    }
                },
                modifier = Modifier.fillMaxWidth().height(60.dp).staggerIn(5),
                shape = RoundedRectangle(24.dp),
                tint = c.brand,
            ) {
                Image(Icons.Rounded.QrCode2, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White))
                Txt(if (busy) "Membuat tagihan…" else "Donasi ${rupiah(amount)} via QRIS", AppText.body(16.sp, Color.White, 800))
            }
            error?.let {
                VGap(8.dp)
                Txt(it, AppText.body(13.sp, c.brand, 700), Modifier.padding(horizontal = 6.dp))
            }
        }

        item { DSection("Ke mana donasinya?", 6) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(vertical = 6.dp).staggerIn(7)) {
                listOf(
                    Triple(Icons.Rounded.Dns, "Server & API", "Worker, cache, dan kuota JKT48Connect API supaya data tetap cepat."),
                    Triple(Icons.Rounded.SmartToy, "Bot X & Discord", "Notifikasi live dan jadwal untuk fans di X dan server Discord."),
                    Triple(Icons.Rounded.Code, "Fitur baru", "Pengembangan aplikasi Android, situs, dan fitur yang kamu minta."),
                ).forEach { (icon, title, desc) ->
                    Row(Modifier.padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(38.dp).background(Brush.linearGradient(listOf(Rose, c.brand)), RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
                            Image(icon, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(Color.White))
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Txt(title, AppText.body(14.5.sp, c.ink, 800))
                            Txt(desc, AppText.body(12.5.sp, c.inkSoft))
                        }
                    }
                }
            }
        }

        item { DSection("Dinding pendukung${wall.data?.count?.let { " · $it" } ?: ""}", 8) }
        val list = wall.data?.supporters
        when {
            list == null && wall.error == null -> item { Skeleton(Modifier.fillMaxWidth().height(120.dp), 24.dp) }
            list.isNullOrEmpty() -> item {
                Txt("Belum ada pendukung. Jadilah yang pertama! ♥", AppText.body(14.sp, c.inkSoft), Modifier.fillMaxWidth().appCard(22.dp).padding(18.dp))
            }
            else -> itemsIndexed(list) { i, s ->
                Row(Modifier.padding(bottom = 8.dp).fillMaxWidth().appCard(20.dp).padding(12.dp).staggerIn(i % 10, 30), verticalAlignment = Alignment.CenterVertically) {
                    val label = s.name.ifEmpty { "Anonim" }
                    val hue = (abs(label.hashCode()) % 60) / 60f
                    Box(
                        Modifier.size(42.dp).background(Brush.linearGradient(listOf(lerpColor(Rose, c.brand, hue), Deep)), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { Txt(label.take(1).uppercase(), AppText.display(20.sp, Color.White)) }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Txt(label, AppText.body(14.5.sp, c.ink, 800), maxLines = 1)
                        Txt(timeAgo(java.time.Instant.ofEpochSecond(s.paidAt).toString()), AppText.mono(11.sp, c.inkSoft))
                    }
                    Txt(rupiah(s.amount), AppText.mono(13.sp, c.brand, FontWeight.SemiBold))
                }
            }
        }

        item {
            VGap(14.dp)
            Txt(
                "Pembayaran QRIS diproses MYPG. Nominal ditambah kode unik beberapa rupiah supaya pembayaran terverifikasi otomatis, jadi bayar tepat sesuai yang tertera. Donasi bersifat sukarela dan tidak dapat dikembalikan.",
                AppText.body(12.sp, c.inkSoft, 500, 1.5f),
                Modifier.padding(horizontal = 6.dp),
            )
        }
    }

    val d = donation
    if (sheet && d != null) {
        PaymentSheet(
            d,
            onUpdate = {
                donation = it
                if (it.status == "SUCCESS") wall.run(true)
            },
            onClose = { sheet = false },
        )
    }
}

private fun lerpColor(a: Color, b: Color, t: Float) = androidx.compose.ui.graphics.lerp(a, b, t)

@Composable
private fun DSection(label: String, index: Int) {
    Micro(label, Modifier.padding(6.dp, 26.dp, 6.dp, 10.dp).staggerIn(index), color = LocalColors.current.brand, dot = true)
}

@Composable
private fun HeroPill(backdrop: com.kyant.backdrop.Backdrop, text: String) {
    Box(Modifier.glass(backdrop, Capsule(), Color.White.copy(alpha = 0.16f), blur = 6.dp, shadow = false).padding(horizontal = 12.dp, vertical = 7.dp)) {
        Txt(text.uppercase(), AppText.micro(Color.White, 9.5.sp))
    }
}

/** Kolom isian kaca (statis) dengan awalan. */
@Composable
private fun GlassField(value: String, onValue: (String) -> Unit, prefix: String, hint: String, modifier: Modifier = Modifier, number: Boolean = false) {
    val c = LocalColors.current
    Row(
        modifier.fillMaxWidth().height(56.dp).glass(LocalBackdrop.current, RoundedRectangle(20.dp), glassFill()).padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Txt(prefix, AppText.body(16.sp, c.brand, 800))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Txt(hint, AppText.body(15.sp, c.inkSoft), maxLines = 1)
            BasicTextField(
                value,
                onValue,
                singleLine = true,
                textStyle = AppText.body(16.sp, c.ink, 700),
                cursorBrush = SolidColor(c.brand),
                keyboardOptions = if (number) KeyboardOptions(keyboardType = KeyboardType.Number) else KeyboardOptions.Default,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Latar merah-merah muda dengan hati yang melayang naik (juga jadi backdrop kaca di atasnya). */
@Composable
private fun HeartsBackground(modifier: Modifier = Modifier) {
    val t by rememberInfiniteTransition(label = "hearts").animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing)), label = "t")
    Canvas(modifier.fillMaxSize().background(Brush.linearGradient(listOf(Deep, Color(0xFFB0102C), Rose), Offset.Zero, Offset(900f, 1400f)))) {
        repeat(9) { i ->
            val p = (t + i / 9f) % 1f
            val x = size.width * ((i * 0.37f + 0.08f) % 1f) + sin((p * 2 * PI + i).toFloat()) * 18.dp.toPx()
            val y = size.height * (1.1f - p * 1.3f)
            val s = (14 + (i % 4) * 8).dp.toPx()
            heart(Offset(x, y), s, Color.White.copy(alpha = 0.10f + 0.12f * sin((p * PI).toFloat())))
        }
    }
}

private fun DrawScope.heart(center: Offset, size: Float, color: Color) {
    val x0 = center.x - size / 2
    val y0 = center.y - size / 2
    fun x(v: Float) = x0 + v * size
    fun y(v: Float) = y0 + v * size
    val p = Path().apply {
        moveTo(x(0.5f), y(0.92f))
        cubicTo(x(0.12f), y(0.66f), x(-0.04f), y(0.38f), x(0.14f), y(0.18f))
        cubicTo(x(0.3f), y(0.0f), x(0.46f), y(0.08f), x(0.5f), y(0.26f))
        cubicTo(x(0.54f), y(0.08f), x(0.7f), y(0.0f), x(0.86f), y(0.18f))
        cubicTo(x(1.04f), y(0.38f), x(0.88f), y(0.66f), x(0.5f), y(0.92f))
        close()
    }
    drawPath(p, color)
}

/**
 * Tagihan QRIS di jendela tersendiri: latar gradien bergerak direkam sebagai backdrop, kartu kaca di atasnya.
 * Status dicek tiap 4 detik selama PENDING; berhasil → animasi terima kasih.
 */
@Composable
private fun PaymentSheet(d: Donation, onUpdate: (Donation) -> Unit, onClose: () -> Unit) {
    val c = LocalColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val open = rememberOpenUrl()
    val bg = rememberLayerBackdrop()
    var cancelling by remember { mutableStateOf(false) }
    LaunchedEffect(d.id, d.status) {
        while (d.status == "PENDING") {
            delay(4000)
            runCatching { Api.donation(d.id) }.onSuccess { if (it.status != d.status) onUpdate(it) }
        }
    }
    val expires = remember(d.expiredAt) {
        runCatching { LocalDateTime.parse(d.expiredAt, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")).atZone(ZoneId.of("Asia/Jakarta")) }.getOrNull()
    }
    var left by remember { mutableStateOf("") }
    LaunchedEffect(expires, d.status) {
        while (expires != null && d.status == "PENDING") {
            val s = Duration.between(java.time.ZonedDateTime.now(), expires).seconds.coerceAtLeast(0)
            left = "%02d:%02d".format(s / 60, s % 60)
            if (s == 0L) break
            delay(1000)
        }
    }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Box(Modifier.fillMaxSize().layerBackdrop(bg)) {
                HeartsBackground()
                Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.25f)))
            }
            Column(
                Modifier
                    .padding(20.dp)
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .glass(bg, RoundedRectangle(36.dp), Color.White.copy(alpha = if (c.dark) 0.10f else 0.22f), blur = 12.dp, lensHeight = 28.dp, lensAmount = 56.dp, depth = true)
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AnimatedContent(d.status, transitionSpec = { (fadeIn(tween(250)) + scaleIn(spring(0.6f, 300f), 0.9f)) togetherWith fadeOut(tween(150)) }, label = "pay") { status ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        when (status) {
                            "SUCCESS" -> ThankYou(d)
                            else -> {
                                StatusPill(status)
                                VGap(14.dp)
                                Txt(rupiah(d.amount), AppText.display(40.sp, Color.White))
                                Txt(
                                    if (status == "PENDING") "Bayar tepat sampai 3 digit terakhir" else if (status == "EXPIRED") "Tagihan kedaluwarsa" else "Tagihan dibatalkan",
                                    AppText.body(12.5.sp, Color.White.copy(alpha = 0.75f)),
                                )
                                VGap(16.dp)
                                Box(Modifier.size(236.dp).background(Color.White, RoundedCornerShape(26.dp)).padding(14.dp), contentAlignment = Alignment.Center) {
                                    NetImage(d.qrImage, Modifier.fillMaxSize().graphicsLayer { alpha = if (status == "PENDING") 1f else 0.25f }, contentScale = androidx.compose.ui.layout.ContentScale.Fit, alignment = Alignment.Center)
                                }
                                VGap(10.dp)
                                if (status == "PENDING" && left.isNotEmpty()) Txt("Berlaku $left lagi · QRIS", AppText.mono(12.sp, Color.White.copy(alpha = 0.85f), FontWeight.SemiBold))
                                VGap(16.dp)
                                if (status == "PENDING") {
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LiquidButton(
                                            onClick = { scope.launch { saveQr(context, d) } },
                                            modifier = Modifier.weight(1f).height(50.dp),
                                            backdrop = bg,
                                            fill = Color.White.copy(alpha = 0.16f),
                                        ) {
                                            Image(Icons.Rounded.Download, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Color.White))
                                            Txt("Simpan QR", AppText.body(13.sp, Color.White, 800))
                                        }
                                        if (d.paymentUrl.isNotEmpty()) LiquidButton(
                                            onClick = { open(d.paymentUrl) },
                                            modifier = Modifier.weight(1f).height(50.dp),
                                            backdrop = bg,
                                            fill = Color.White.copy(alpha = 0.16f),
                                        ) {
                                            Image(Icons.Rounded.OpenInNew, null, Modifier.size(17.dp), colorFilter = ColorFilter.tint(Color.White))
                                            Txt("Halaman bayar", AppText.body(13.sp, Color.White, 800))
                                        }
                                    }
                                    VGap(10.dp)
                                    Txt(
                                        "Simpan QR lalu buka e-wallet/m-banking → Scan → pilih dari galeri. Halaman ini memeriksa pembayaran otomatis.",
                                        AppText.body(12.sp, Color.White.copy(alpha = 0.75f), 500, 1.45f),
                                    )
                                    VGap(12.dp)
                                    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                                        Txt("Tutup", AppText.body(13.sp, Color.White, 800), Modifier.pressable(onClose).padding(8.dp))
                                        Txt(
                                            if (cancelling) "Membatalkan…" else "Batalkan tagihan",
                                            AppText.body(13.sp, Color.White.copy(alpha = 0.7f), 700),
                                            Modifier.pressable({
                                                if (cancelling) return@pressable
                                                cancelling = true
                                                scope.launch {
                                                    runCatching { Api.cancelDonation(d.id) }.onSuccess(onUpdate)
                                                    cancelling = false
                                                }
                                            }).padding(8.dp),
                                        )
                                    }
                                } else {
                                    LiquidButton(onClick = onClose, modifier = Modifier.fillMaxWidth().height(50.dp), backdrop = bg, fill = Color.White.copy(alpha = 0.16f)) {
                                        Txt("Tutup", AppText.body(14.sp, Color.White, 800))
                                    }
                                }
                            }
                        }
                    }
                }
                if (d.status == "SUCCESS") {
                    VGap(18.dp)
                    LiquidButton(onClick = onClose, modifier = Modifier.fillMaxWidth().height(52.dp), backdrop = bg, tint = Color.White.copy(alpha = 0.9f)) {
                        Txt("Sama-sama ♥", AppText.body(14.sp, Deep, 800))
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(0.35f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "a")
    val (label, dot) = when (status) {
        "PENDING" -> "MENUNGGU PEMBAYARAN" to Color(0xFFFFD166)
        "EXPIRED" -> "KEDALUWARSA" to Color(0xFFBDBDBD)
        else -> "DIBATALKAN" to Color(0xFFBDBDBD)
    }
    Row(Modifier.background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).graphicsLayer { alpha = if (status == "PENDING") pulse else 1f }.background(dot, CircleShape))
        Spacer(Modifier.width(8.dp))
        Txt(label, AppText.micro(Color.White, 9.5.sp))
    }
}

/** Animasi terima kasih: hati membesar dengan percikan hati kecil. */
@Composable
private fun ThankYou(d: Donation) {
    val t by rememberInfiniteTransition(label = "ty").animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing)), label = "t")
    Box(Modifier.size(170.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            repeat(10) { i ->
                val a = (i / 10f) * 2 * PI
                val r = size.minDimension * (0.2f + 0.3f * t)
                val pos = Offset(center.x + (kotlin.math.cos(a) * r).toFloat(), center.y + (sin(a) * r).toFloat())
                heart(pos, 14.dp.toPx() * (1f - t * 0.5f), Color.White.copy(alpha = 1f - t))
            }
        }
        val beat = 1f + 0.08f * sin(t * 2 * PI.toFloat() * 2)
        Image(Icons.Rounded.Favorite, null, Modifier.size(92.dp).graphicsLayer { scaleX = beat; scaleY = beat }, colorFilter = ColorFilter.tint(Color.White))
    }
    Txt("TERIMA KASIH!", AppText.display(34.sp, Color.White))
    VGap(6.dp)
    Txt(
        "${if (d.name.isNotEmpty()) "${d.name}, d" else "D"}onasi ${rupiah(d.amount)} sudah diterima. Namamu kini ada di dinding pendukung.",
        AppText.body(14.sp, Color.White.copy(alpha = 0.88f), 500, 1.5f),
    )
}

/** Simpan gambar QR ke galeri (Android 10+ tanpa izin); versi lama diarahkan ke halaman bayar. */
private suspend fun saveQr(context: android.content.Context, d: Donation) {
    val ok = withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT < 29) return@withContext false
        val bmp: Bitmap = Images.load(d.qrImage, 1024) ?: return@withContext false
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "QRIS-JKT48Connect-${d.id}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/JKT48Connect")
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return@withContext false
        context.contentResolver.openOutputStream(uri)?.use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } != null
    }
    Toast.makeText(context, if (ok) "QR disimpan ke Galeri › Pictures/JKT48Connect" else "Tidak bisa menyimpan QR. Pakai tombol Halaman bayar.", Toast.LENGTH_LONG).show()
}
