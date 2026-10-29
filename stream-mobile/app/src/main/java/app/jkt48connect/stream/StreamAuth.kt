package app.jkt48connect.stream

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.dp
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import kotlinx.coroutines.launch

/** Tiga layar pengenalan, lalu lanjut ke halaman masuk. */
@Composable fun Onboarding(done: () -> Unit) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    val c = LocalColors.current
    val titles = listOf("Panggungnya dekat.\nCeritanya ikut.", "Live IDN & Showroom.\nSemua di satu tempat.", "Masuk, lalu\nambil tempatmu.")
    val captions = listOf(
        "Theater, live member, dan replay dalam JKT48Connect Stream.",
        "Tonton live IDN dan Showroom langsung di aplikasi, lalu putar ulang momen yang ingin kamu simpan.",
        "Pakai akun lamamu atau buat akun baru. Untuk theater, pilih tiket satu show atau Pass.",
    )
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Mark(44.dp)
            Micro("Stream · ${step + 1} / 3")
        }
        AnimatedContent(step, transitionSpec = { fadeIn(tween(220)).togetherWith(fadeOut(tween(160))) }, label = "intro-step") { s ->
            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Label(titles[s], 38, true)
                GlassCard(Modifier.fillMaxWidth().height(230.dp), padding = 22.dp) {
                    Micro("JKT48Connect · Stream")
                    Image(
                        if (s == 1) StreamIcons.Sensors else if (s == 2) StreamIcons.Person else StreamIcons.TheaterComedy,
                        null,
                        Modifier.size(56.dp),
                        colorFilter = ColorFilter.tint(c.brand),
                    )
                    Label(if (s == 0) "THIS IS YOUR\nFRONT ROW." else if (s == 1) "LIVE NOW.\nIDN + SHOWROOM." else "YOUR PASS.\nYOUR MOMENT.", 28, true)
                }
                Label(captions[s], 16, color = c.inkSoft)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            repeat(3) { Box(Modifier.size(if (it == step) 26.dp else 7.dp, 7.dp).background(if (it == step) c.brand else c.line, CircleShape)) }
        }
        ActionButton(if (step < 2) "Lanjut →" else "Mulai menonton →", primary = true) { if (step < 2) step++ else done() }
        Spacer(Modifier.height(18.dp))
    }
}

/** Masuk atau daftar akun Stream. */
@Composable fun Auth() {
    var register by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Spacer(Modifier.height(12.dp))
        Mark(52.dp)
        Micro("JKT48Connect Stream")
        Label(if (register) "Tempatmu\nsudah menunggu." else "Senang kamu\nkembali.", 40, true)
        Label("Masuk dengan akun web lamamu. Riwayat dan akses yang masih aktif ikut bersamamu.", 15, color = LocalColors.current.inkSoft)
        LiquidTabs(listOf(TabItem("Masuk"), TabItem("Daftar")), if (register) 1 else 0, { register = it == 1; error = "" }, Modifier.fillMaxWidth(), segmented = true)
        GlassCard {
            if (register) Field("Nama panggilan", name) { name = it }
            Field("Email", email) { email = it }
            Field("Password", password, true) { password = it }
            if (error.isNotEmpty()) Label(error, 13, color = LocalColors.current.brand)
            ActionButton(if (busy) "Sebentar…" else if (register) "Buat akun →" else "Masuk →", primary = true) {
                if (!busy) {
                    scope.launch {
                        busy = true; error = ""
                        runCatching { StreamApi.auth(email, password, name, register) }.onFailure { error = it.message.orEmpty() }
                        busy = false
                    }
                }
            }
        }
        Label("Dengan melanjutkan, kamu menyetujui ketentuan penggunaan. JKT48Connect adalah layanan komunitas independen.", 12, color = LocalColors.current.inkSoft)
    }
}
