package app.jkt48connect.stream

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val Deep = Color(0xFF5A0A18)

/** Waktu kedaluwarsa dari gateway: ISO, atau "yyyy-MM-dd HH:mm:ss" (WIB). */
private fun expiryMillis(value: String): Long? =
    parseInstant(value)?.toEpochMilli() ?: runCatching {
        LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")).atZone(ZoneId.of("Asia/Jakarta")).toInstant().toEpochMilli()
    }.getOrNull()

private fun isPaid(status: String) = status.lowercase() in setOf("paid", "success", "settled")
private fun isPending(status: String) = status.lowercase() in setOf("pending", "creating")

/**
 * Tagihan QRIS (pola lembar donasi 2.6.1): latar gradien merah gelap dengan logo piksel melayang direkam sebagai
 * backdrop, kartu kaca tebal di atasnya. Status dicek tiap 4 detik selama menunggu; lunas → animasi berhasil.
 * Server tetap memeriksa pembayaran walau halaman ini ditutup.
 */
@Composable
fun PayScreen(initial: JSONObject) {
    val nav = LocalNav.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val open = rememberOpenUrl()
    val id = initial.optString("id")
    var p by remember(id) { mutableStateOf(initial) }
    val status = p.optString("status")
    val legacy = p.optBoolean("legacy")
    LaunchedEffect(id) {
        while (!legacy && isPending(p.optString("status"))) {
            runCatching { StreamApi.request("/payments/$id") }.onSuccess { p = it }
            if (!isPending(p.optString("status"))) break
            delay(4_000)
        }
        if (isPaid(p.optString("status"))) nav.reload++
    }
    val expires = remember(p.optString("expiresAt")) { expiryMillis(p.optString("expiresAt")) }
    var left by remember { mutableStateOf("") }
    LaunchedEffect(expires, status) {
        while (expires != null && isPending(status)) {
            val s = ((expires - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            left = "%02d:%02d".format(s / 60, s % 60)
            if (s == 0L) break
            delay(1000)
        }
    }

    val bg = rememberLayerBackdrop()
    val top = LocalInsets.current.calculateTopPadding()
    val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().layerBackdrop(bg)) { PayBackground() }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = top + 8.dp, bottom = bottom + 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Micro(if (legacy) "Riwayat pembayaran" else "Checkout · QRIS", color = Color.White.copy(alpha = 0.75f))
            VGap(4.dp)
            Txt(planName(p.optString("plan")).uppercase(), AppText.display(30.sp, Color.White), maxLines = 1)
            VGap(18.dp)
            Column(
                Modifier
                    .padding(horizontal = 20.dp)
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .glass(bg, RoundedRectangle(36.dp), Color.White.copy(alpha = 0.16f), blur = 12.dp, lensHeight = 28.dp, lensAmount = 56.dp, depth = true)
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AnimatedContent(
                    if (isPaid(status) && !legacy) "paid" else if (legacy) "legacy" else status,
                    transitionSpec = { (fadeIn(tween(250)) + scaleIn(spring(0.6f, 300f), 0.9f)) togetherWith fadeOut(tween(150)) },
                    label = "pay",
                ) { state ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        when {
                            state == "paid" -> Success(p) {
                                nav.pop()
                                nav.tab = if (p.optString("plan") == "show") 2 else 4
                            }
                            state == "legacy" -> {
                                StatusPill(status)
                                VGap(14.dp)
                                Txt(rupiah(p.optLong("total")), AppText.display(40.sp, Color.White))
                                VGap(6.dp)
                                Txt(
                                    "Pembayaran dari akun web lama. Akses yang masih aktif sudah ikut ke Stream.",
                                    AppText.body(13.sp, Color.White.copy(alpha = 0.8f), 500, 1.45f),
                                )
                            }
                            else -> {
                                StatusPill(status)
                                VGap(14.dp)
                                Txt(rupiah(p.optLong("total")), AppText.display(42.sp, Color.White))
                                Txt(
                                    if (isPending(status)) "Bayar tepat sampai 3 digit terakhir" else "Tagihan ini sudah tidak berlaku",
                                    AppText.body(12.5.sp, Color.White.copy(alpha = 0.75f)),
                                )
                                VGap(16.dp)
                                Box(Modifier.size(236.dp).background(Color.White, RoundedCornerShape(26.dp)).padding(14.dp), contentAlignment = Alignment.Center) {
                                    Picture(
                                        p.optString("qr"),
                                        Modifier.fillMaxSize().background(Color.White).graphicsLayer { alpha = if (isPending(status)) 1f else 0.2f },
                                        contentScale = ContentScale.Fit,
                                    )
                                }
                                VGap(10.dp)
                                if (isPending(status) && left.isNotEmpty()) Txt("Berlaku $left lagi · QRIS", AppText.mono(12.sp, Color.White.copy(alpha = 0.85f), FontWeight.SemiBold))
                                VGap(16.dp)
                                if (isPending(status)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        LiquidButton(
                                            onClick = { scope.launch { saveQr(context, p) } },
                                            modifier = Modifier.weight(1f).height(50.dp),
                                            backdrop = bg,
                                            fill = Color.White.copy(alpha = 0.16f),
                                        ) {
                                            Image(StreamIcons.Download, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Color.White))
                                            Txt("Simpan QR", AppText.body(13.sp, Color.White, 800))
                                        }
                                        if (p.optString("payUrl").startsWith("https://")) LiquidButton(
                                            onClick = { open(p.optString("payUrl")) },
                                            modifier = Modifier.weight(1f).height(50.dp),
                                            backdrop = bg,
                                            fill = Color.White.copy(alpha = 0.16f),
                                        ) {
                                            Image(StreamIcons.External, null, Modifier.size(17.dp), colorFilter = ColorFilter.tint(Color.White))
                                            Txt("Link bayar", AppText.body(13.sp, Color.White, 800), maxLines = 1)
                                        }
                                    }
                                    VGap(12.dp)
                                    Txt(
                                        "Simpan QR lalu buka e-wallet/m-banking → Scan → pilih dari galeri. Status diperiksa otomatis, dan server tetap memeriksa walau aplikasi ditutup.",
                                        AppText.body(12.sp, Color.White.copy(alpha = 0.75f), 500, 1.45f),
                                    )
                                } else {
                                    LiquidButton(onClick = { nav.pop() }, modifier = Modifier.fillMaxWidth().height(50.dp), backdrop = bg, fill = Color.White.copy(alpha = 0.16f)) {
                                        Txt("Kembali", AppText.body(14.sp, Color.White, 800))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Latar halaman bayar: gradien merah tua dengan logo piksel besar yang melayang pelan. */
@Composable
private fun PayBackground() {
    val t by rememberInfiniteTransition(label = "paybg").animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing), RepeatMode.Reverse), label = "t")
    Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFFE1243A), Color(0xFFA5122A), Deep), Offset.Zero, Offset(900f, 2400f)))) {
        PixelLogo(260.dp, Modifier.align(Alignment.TopEnd).offset(90.dp, (-40).dp + 30.dp * t).graphicsLayer { rotationZ = 14f + 8f * t; alpha = 0.16f }, color = Color.White)
        PixelLogo(180.dp, Modifier.align(Alignment.BottomStart).offset((-60).dp, (-60).dp * t).graphicsLayer { rotationZ = -10f - 6f * t; alpha = 0.12f }, color = Color.White)
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.18f)))
    }
}

@Composable
private fun StatusPill(status: String) {
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(0.35f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "a")
    val (label, dot) = when {
        isPending(status) -> "Menunggu pembayaran" to Color(0xFFFFD166)
        isPaid(status) -> "Lunas" to Color(0xFF7BE495)
        status.lowercase() == "expired" -> "Kedaluwarsa" to Color(0xFFBDBDBD)
        else -> status.ifEmpty { "Tagihan" } to Color(0xFFBDBDBD)
    }
    Row(Modifier.background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).graphicsLayer { alpha = if (isPending(status)) pulse else 1f }.background(dot, CircleShape))
        Gap(8.dp)
        Txt(label.uppercase(), AppText.micro(Color.White, 9.5.sp))
    }
}

/** Berhasil: lingkaran centang yang berdenyut dengan pancaran piksel, lalu tombol menonton. */
@Composable
private fun Success(p: JSONObject, onDone: () -> Unit) {
    val t by rememberInfiniteTransition(label = "ok").animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing)), label = "t")
    val show = p.optString("plan") == "show"
    Box(Modifier.size(170.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            repeat(12) { i ->
                val a = (i / 12f) * 2 * Math.PI
                val r = size.minDimension * (0.22f + 0.28f * t)
                val s = 10.dp.toPx() * (1f - t * 0.6f)
                drawRect(
                    Color.White.copy(alpha = 1f - t),
                    topLeft = Offset(center.x + (Math.cos(a) * r).toFloat() - s / 2, center.y + (Math.sin(a) * r).toFloat() - s / 2),
                    size = androidx.compose.ui.geometry.Size(s, s),
                )
            }
        }
        val beat = 1f + 0.06f * kotlin.math.sin(t * 2 * Math.PI.toFloat() * 2)
        Box(Modifier.size(96.dp).graphicsLayer { scaleX = beat; scaleY = beat }.background(Color.White, CircleShape), contentAlignment = Alignment.Center) {
            Image(StreamIcons.Check, null, Modifier.size(54.dp), colorFilter = ColorFilter.tint(Color(0xFFE1243A)))
        }
    }
    Txt(if (show) "TIKETMU AKTIF!" else "PASS AKTIF!", AppText.display(34.sp, Color.White))
    VGap(6.dp)
    Txt(
        if (show) "Pembayaran ${rupiah(p.optLong("total"))} diterima. Pemutar terbuka saat show dimulai."
        else "Pembayaran ${rupiah(p.optLong("total"))} diterima. Semua theater terbuka selama masa aktif.",
        AppText.body(14.sp, Color.White.copy(alpha = 0.88f), 500, 1.5f),
    )
    VGap(18.dp)
    Box(
        Modifier.fillMaxWidth().height(52.dp).background(Color.White.copy(alpha = 0.92f), CircleShape).pressable(onDone),
        contentAlignment = Alignment.Center,
    ) {
        Txt(if (show) "Lihat jadwal theater" else "Lihat akunku", AppText.body(15.sp, Deep, 800))
    }
}

/** Simpan gambar QR ke galeri (Android 10+ tanpa izin); versi lama diarahkan ke halaman bayar. */
private suspend fun saveQr(context: Context, p: JSONObject) {
    val ok = withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT < 29) return@withContext false
        val bmp: Bitmap = runCatching { StreamApi.bitmap(p.optString("qr")) }.getOrNull() ?: return@withContext false
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "QRIS-JKT48Connect-Stream-${p.optString("id").takeLast(10)}.png")
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/JKT48Connect")
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return@withContext false
        context.contentResolver.openOutputStream(uri)?.use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } == true
    }
    Toast.makeText(context, if (ok) "QR disimpan ke Galeri › Pictures/JKT48Connect" else "Tidak bisa menyimpan QR. Pakai tombol Halaman bayar.", Toast.LENGTH_LONG).show()
}
