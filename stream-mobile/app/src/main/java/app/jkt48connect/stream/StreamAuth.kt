package app.jkt48connect.stream

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.stream.ui.theme.*
import kotlinx.coroutines.launch

private val Ink = Color(0xFF1D1517)

private data class Act(val fill: String, val outline: String, val body: String, val cta: String)

private val ACTS = listOf(
    Act("PANGGUNG", "DI SAKUMU", "Theater JKT48, live member, dan replay dalam satu aplikasi. Tanpa pindah-pindah.", "Lanjut ke babak 2"),
    Act("IDN & SHOWROOM", "SATU LAYAR", "Live dari dua platform diputar langsung di sini. Ketinggalan? Replay-nya menunggu, tanpa jeda 72 jam.", "Lanjut ke babak 3"),
    Act("TIKETMU", "TINGGAL SCAN", "Rp4.000 untuk satu show, atau Stream Pass untuk semua theater. Bayar pakai QRIS dari e-wallet apa pun.", "Buka tirai"),
)

/**
 * Pengenalan "tiga babak": layar merah intro 2.6.1 dengan gelombang sinyal yang terus memancar, visual khas
 * tiap babak, judul dua baris (isi + garis tepi), dan tombol putih. Babak terakhir membuka tirai:
 * layar merah terangkat ke atas seperti tirai panggung.
 */
@Composable
fun Onboarding(done: () -> Unit) {
    var act by rememberSaveable { mutableIntStateOf(0) }
    val curtain = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    fun finish() {
        if (curtain.isRunning) return
        scope.launch {
            curtain.animateTo(1f, tween(560, easing = FastOutSlowInEasing))
            done()
        }
    }
    val waves by rememberInfiniteTransition(label = "waves").animateFloat(0f, 1f, infiniteRepeatable(tween(2600, easing = LinearEasing)), label = "w")
    val last = act == ACTS.lastIndex

    Box(
        Modifier
            .fillMaxSize()
            .graphicsLayer { translationY = -size.height * curtain.value }
            .clip(RoundedCornerShape(bottomStart = 48.dp * curtain.value, bottomEnd = 48.dp * curtain.value))
            .background(Brush.linearGradient(listOf(Color(0xFFF0304A), Color(0xFFE1243A), Color(0xFFA5122A)), Offset.Zero, Offset(900f, 2200f))),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            for (i in 0..2) {
                val k = (waves + i / 3f) % 1f
                drawCircle(
                    Color.White.copy(alpha = 0.18f * (1f - k)),
                    radius = 70.dp.toPx() + size.minDimension * 0.6f * k,
                    center = Offset(size.width / 2, size.height * 0.33f),
                    style = Stroke(1.5.dp.toPx()),
                )
            }
        }
        Column(Modifier.fillMaxSize().systemBarsPadding().padding(horizontal = 24.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PixelLogo(22.dp, color = Color.White)
                Gap(10.dp)
                Micro("JKT48Connect · Stream", Modifier.weight(1f), Color.White.copy(alpha = 0.85f))
                if (!last) {
                    Box(Modifier.background(Color.White.copy(alpha = 0.16f), CircleShape).pressable({ finish() }).padding(horizontal = 14.dp, vertical = 8.dp)) {
                        Txt("Lewati", AppText.body(13.sp, Color.White, 800))
                    }
                }
            }
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                AnimatedContent(
                    act,
                    transitionSpec = { (fadeIn(tween(380)) + scaleInSoft()) togetherWith fadeOut(tween(180)) },
                    label = "act-visual",
                ) { a -> ActVisual(a) }
            }
            AnimatedContent(
                act,
                transitionSpec = { (slideInVertically(tween(420)) { it / 4 } + fadeIn(tween(320))) togetherWith (slideOutVertically(tween(220)) { -it / 6 } + fadeOut(tween(160))) },
                label = "act-text",
            ) { a ->
                Column {
                    Micro("Babak 0${a + 1} · dari 03", color = Color.White.copy(alpha = 0.7f))
                    VGap(10.dp)
                    Txt(ACTS[a].fill, AppText.display(46.sp, Color.White))
                    Txt(ACTS[a].outline, AppText.display(46.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
                    VGap(12.dp)
                    Txt(ACTS[a].body, AppText.body(16.sp, Color.White.copy(alpha = 0.88f), 500, 1.45f))
                }
            }
            VGap(24.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ACTS.indices.forEach { i ->
                    Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (i <= act) Color.White else Color.White.copy(alpha = 0.3f)))
                }
            }
            VGap(16.dp)
            Row(
                Modifier.fillMaxWidth().height(58.dp).background(Color.White, CircleShape).pressable({ if (last) finish() else act++ }),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Txt(ACTS[act].cta, AppText.body(17.sp, Color(0xFFE1243A), 800))
                Gap(6.dp)
                Image(StreamIcons.Chevron, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(Color(0xFFE1243A)))
            }
            VGap(8.dp)
        }
    }
}

private fun scaleInSoft() = androidx.compose.animation.scaleIn(spring(0.65f, 260f), initialScale = 0.86f)

/** Visual tengah tiap babak. */
@Composable
private fun ActVisual(act: Int) {
    when (act) {
        0 -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PixelLogo(120.dp, color = Color.White, assemble = true)
            VGap(18.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                SignalBars(color = Color.White, height = 11.dp)
                Gap(8.dp)
                Micro("Fan signal · Live · Theater · Replay", color = Color.White.copy(alpha = 0.8f), size = 9.5f)
            }
        }
        1 -> Box(Modifier.size(280.dp, 230.dp)) {
            PlatformCard("IDN LIVE", "Live · IDN", "Diputar di aplikasi", light = true, Modifier.align(Alignment.TopStart).graphicsLayer { rotationZ = -7f })
            PlatformCard("SHOWROOM", "Live · Showroom", "Kualitas otomatis", light = false, Modifier.align(Alignment.BottomEnd).graphicsLayer { rotationZ = 6f })
        }
        else -> TicketArt(Modifier.graphicsLayer { rotationZ = -5f })
    }
}

@Composable
private fun PlatformCard(name: String, tag: String, note: String, light: Boolean, modifier: Modifier) {
    val fg = if (light) Ink else Color.White
    Column(
        modifier
            .width(196.dp)
            .shadow(18.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(if (light) Color.White else Ink)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LiveDot(Color(0xFFE1243A))
            Gap(7.dp)
            Micro(tag, color = if (light) Color(0xFFE1243A) else Color.White.copy(alpha = 0.7f), size = 9.5f)
        }
        VGap(22.dp)
        Txt(name, AppText.display(30.sp, fg), maxLines = 1)
        Micro(note, color = fg.copy(alpha = 0.55f), size = 9.5f)
    }
}

/** Tiket theater: badan putih, garis sobek putus-putus berlubang, stub dengan logo piksel. */
@Composable
private fun TicketArt(modifier: Modifier) {
    val red = Color(0xFFE1243A)
    Box(modifier.size(290.dp, 140.dp).shadow(18.dp, RoundedCornerShape(24.dp)).clip(RoundedCornerShape(24.dp)).background(Color.White)) {
        Row(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).fillMaxHeight().padding(18.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Micro("Admit one", color = red, size = 9.5f)
                Column {
                    Txt("THEATER", AppText.display(34.sp, Ink))
                    Micro("Rp4.000 · QRIS", color = Ink.copy(alpha = 0.55f), size = 9.5f)
                }
            }
            Box(Modifier.width(86.dp).fillMaxHeight(), contentAlignment = Alignment.Center) { PixelLogo(38.dp, color = red) }
        }
        Canvas(Modifier.fillMaxSize()) {
            val x = size.width - 86.dp.toPx()
            drawLine(Ink.copy(alpha = 0.2f), Offset(x, 14.dp.toPx()), Offset(x, size.height - 14.dp.toPx()), strokeWidth = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(9f, 7f)))
            drawCircle(red, 11.dp.toPx(), Offset(x, 0f))
            drawCircle(Color(0xFFB8172E), 11.dp.toPx(), Offset(x, size.height))
        }
    }
}

/**
 * Masuk/daftar sebagai tiket masuk: blok merah di atas dengan judul besar, lalu kartu tiket berisi stub
 * "ADMIT ONE" + nomor kursi (dari email), pemilih Masuk/Daftar gaya iOS, kolom isian, garis sobek berlubang,
 * dan barcode di stub bawah.
 */
@Composable
fun AuthScreen() {
    var register by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val c = LocalColors.current
    val seat = remember(email) {
        val h = email.trim().lowercase().hashCode() and 0x7fffffff
        "${'A' + h % 8}-${(h / 8) % 24 + 1}"
    }
    fun submit() {
        if (busy) return
        busy = true
        error = ""
        scope.launch {
            runCatching { StreamApi.auth(email.trim(), password, name.trim(), register) }.onFailure { error = it.message.orEmpty() }
            busy = false
        }
    }

    Box(Modifier.fillMaxSize().background(c.bg)) {
        Box(Modifier.fillMaxWidth().fillMaxHeight(0.46f).clip(RoundedCornerShape(bottomStart = 40.dp, bottomEnd = 40.dp)).background(c.brandGradient)) {
            PixelLogo(240.dp, Modifier.align(Alignment.TopEnd).offset(70.dp, 10.dp).graphicsLayer { rotationZ = 18f; alpha = 0.13f }, color = Color.White)
        }
        Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            VGap(18.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                PixelLogo(22.dp, color = Color.White)
                Gap(10.dp)
                Micro("JKT48Connect · Stream", color = Color.White.copy(alpha = 0.85f))
            }
            VGap(26.dp)
            AnimatedContent(register, transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(140)) }, label = "auth-title") { r ->
                Column {
                    Txt(if (r) "AMBIL" else "MASUK", AppText.display(52.sp, Color.White))
                    Txt(if (r) "KURSIMU" else "KE PANGGUNG", AppText.display(52.sp, Color.White).copy(drawStyle = Stroke(width = 3f)))
                }
            }
            VGap(8.dp)
            Txt(
                if (register) "Satu akun untuk theater, live, dan replay." else "Akun web JKT48Connect tetap berlaku di sini.",
                AppText.body(15.sp, Color.White.copy(alpha = 0.88f)),
            )
            VGap(22.dp)

            Column(
                Modifier.fillMaxWidth()
                    .shadow(20.dp, RoundedCornerShape(28.dp), ambientColor = Color(0x33000000), spotColor = Color(0x33000000))
                    .clip(RoundedCornerShape(28.dp))
                    .background(c.card),
            ) {
                Row(Modifier.fillMaxWidth().padding(20.dp, 18.dp, 20.dp, 0.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Micro("Admit one", color = c.brand)
                        Txt("STREAM PASS", AppText.display(22.sp, c.ink))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Micro("Kursi")
                        Txt(seat, AppText.display(22.sp, c.brand))
                    }
                }
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    ModeSwitch(register) { register = it; error = "" }
                    if (register) GlassField("Nama panggilan", name, "Nama yang tampil di obrolan") { name = it.take(40) }
                    GlassField("Email", email, "nama@email.com", keyboard = KeyboardType.Email) { email = it.trim() }
                    GlassField("Password", password, if (register) "Minimal 8 karakter" else "Password akunmu", password = true) { password = it }
                    if (error.isNotEmpty()) Txt(error, AppText.body(13.sp, c.brand, 600))
                    PrimaryButton(if (busy) "Sebentar…" else if (register) "Buat akun" else "Masuk") { submit() }
                }
                Canvas(Modifier.fillMaxWidth().height(28.dp)) {
                    val mid = size.height / 2f
                    val notch = 14.dp.toPx()
                    drawLine(c.line, Offset(notch + 8f, mid), Offset(size.width - notch - 8f, mid), strokeWidth = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
                    drawCircle(c.bg, notch, Offset(0f, mid))
                    drawCircle(c.bg, notch, Offset(size.width, mid))
                }
                Row(Modifier.fillMaxWidth().padding(20.dp, 4.dp, 20.dp, 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Barcode(seat, Modifier.weight(1f).height(34.dp))
                    Gap(14.dp)
                    Column(horizontalAlignment = Alignment.End) {
                        Micro("Theater · Live", size = 9f)
                        Micro("Replay · QRIS", size = 9f)
                    }
                }
            }

            VGap(16.dp)
            Row(Modifier.fillMaxWidth().pressable({ register = !register; error = "" }).padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center) {
                Txt(if (register) "Sudah punya akun? " else "Belum punya akun? ", AppText.body(15.sp, c.inkSoft))
                Txt(if (register) "Masuk" else "Daftar", AppText.body(15.sp, c.brand, 800))
            }
            VGap(8.dp)
            Txt(
                "Dengan melanjutkan, kamu menyetujui ketentuan penggunaan. JKT48Connect adalah layanan komunitas independen, tidak berafiliasi dengan JKT48 Operation Team.",
                AppText.body(12.sp, c.inkSoft, 500, 1.45f),
            )
            VGap(24.dp)
        }
    }
}

/** Pemilih dua opsi gaya segmented control iOS. */
@Composable
private fun ModeSwitch(register: Boolean, onChange: (Boolean) -> Unit) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().height(42.dp).background(c.surface, CircleShape).padding(4.dp)) {
        listOf(false to "Masuk", true to "Daftar").forEach { (value, label) ->
            val on = value == register
            Box(
                Modifier.weight(1f).fillMaxHeight()
                    .then(if (on) Modifier.shadow(4.dp, CircleShape).background(c.card, CircleShape) else Modifier)
                    .pressable({ onChange(value) }),
                contentAlignment = Alignment.Center,
            ) {
                Txt(label, AppText.body(14.sp, if (on) c.ink else c.inkSoft, if (on) 800 else 600))
            }
        }
    }
}

/** Barcode hiasan: batang hitam-putih dengan lebar acak tetap (dari nomor kursi). */
@Composable
private fun Barcode(seed: String, modifier: Modifier) {
    val ink = LocalColors.current.ink
    val bars = remember(seed) {
        val r = java.util.Random(seed.hashCode().toLong())
        List(42) { 1 + r.nextInt(3) }
    }
    Canvas(modifier) {
        val unit = size.width / bars.sumOf { it + 1 }
        var x = 0f
        bars.forEachIndexed { i, w ->
            if (i % 2 == 0) drawRect(ink.copy(alpha = 0.85f), Offset(x, 0f), Size(unit * w, size.height))
            x += unit * (w + 1)
        }
    }
}
