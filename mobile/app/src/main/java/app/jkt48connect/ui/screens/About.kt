package app.jkt48connect.ui.screens

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.ui.graphics.Brush
import app.jkt48connect.ui.Route
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.SmartToy
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.jkt48connect.BuildConfig
import app.jkt48connect.core.Api
import app.jkt48connect.core.Notify
import app.jkt48connect.core.NotifyKind
import app.jkt48connect.core.Updater
import app.jkt48connect.core.Push
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidTabs
import app.jkt48connect.ui.glass.LiquidToggle
import app.jkt48connect.ui.glass.TabItem
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import app.jkt48connect.ui.theme.ThemeController
import app.jkt48connect.ui.theme.ThemeMode

private const val CREATOR_X = "https://x.com/valzyys"

private data class Eco(val title: String, val handle: String, val desc: String, val url: String, val icon: ImageVector?)

/** Saluran JKT48Connect (sama dengan halaman Tentang di situs). URL kosong = situs dari API_BASE. */
private val ECOSYSTEM = listOf(
    Eco("Situs web", "jkt48connect", "Live, jadwal, rekap, dan replay di browser.", "", Icons.Rounded.Language),
    Eco("Bot X", "@JKT48Connect", "Notifikasi member live di IDN & Showroom, plus jadwal theater harian.", "https://x.com/JKT48Connect", null),
    Eco("Bot Discord", "JKT48Connect", "Notifikasi live & jadwal untuk server fanbase, dengan perintah berita, theater, rekap, dan member.", "https://discord.com/discovery/applications/1305141693477027891", Icons.Rounded.SmartToy),
    Eco("Public API", "api.jkt48connect.app", "Data yang sama, terbuka untuk website, aplikasi, dan bot komunitas.", "https://api.jkt48connect.app/docs", Icons.Rounded.Code),
)

private val FEATURES = listOf(
    Triple(Icons.Rounded.LiveTv, "Live realtime", "Member yang sedang live di IDN & Showroom, langsung dari beranda."),
    Triple(Icons.Rounded.CalendarMonth, "Jadwal theater & event", "Show mendatang dengan hitung mundur, lineup, dan setlist."),
    Triple(Icons.Rounded.History, "Rekap & replay", "Statistik live, gift, top supporter, cuplikan, dan replay layar penuh."),
    Triple(Icons.Rounded.Groups, "Profil member", "Biodata, sosial media, serta theater dan live terakhir."),
    Triple(Icons.Rounded.NotificationsActive, "Notifikasi", "Live, show, ulang tahun, berita, dan update aplikasi."),
    Triple(Icons.Rounded.SystemUpdate, "Update otomatis", "Versi baru langsung ditawarkan dan dipasang dari aplikasi."),
)

/** Halaman Tentang: pembuat, ekosistem JKT48Connect, fitur, versi, notifikasi, tema, sumber resmi, kredit, dan penafian. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AboutScreen() {
    val c = LocalColors.current
    val context = LocalContext.current
    val open = rememberOpenUrl()
    val nav = app.jkt48connect.ui.LocalNav.current

    // Status izin dibaca ulang setiap kembali ke aplikasi (mis. setelah mengubahnya di Pengaturan).
    var tick by remember { mutableIntStateOf(0) }
    val lifecycle = (context as? ComponentActivity)?.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) tick++ }
        lifecycle?.addObserver(observer)
        onDispose { lifecycle?.removeObserver(observer) }
    }
    val permitted = remember(tick) { Notify.permitted(context) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    val scope = rememberCoroutineScope()
    var checking by remember { mutableStateOf(false) }
    var checked by remember { mutableStateOf(false) }
    var checkError by remember { mutableStateOf(false) }
    val toggles = remember { mutableStateMapOf<NotifyKind, Boolean>().apply { NotifyKind.entries.forEach { put(it, Notify.enabled(context, it)) } } }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 48.dp)) {
        item {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(30.dp)).background(c.brandGradient).padding(22.dp).staggerIn(0),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(54.dp).background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                        PixelLogo(30.dp, color = Color.White)
                    }
                    Spacer(Modifier.weight(1f))
                    SignalBars(color = Color.White, height = 16.dp)
                }
                VGap(22.dp)
                Row {
                    Txt("JKT48", AppText.display(38.sp, Color.White))
                    Txt("CONNECT", AppText.display(38.sp, Color(0xFF1A0508)))
                }
                VGap(6.dp)
                Txt("Live, jadwal theater, rekap, dan replay member JKT48 dalam satu aplikasi.", AppText.body(14.sp, Color.White.copy(alpha = 0.85f)))
                VGap(16.dp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("v${BuildConfig.VERSION_NAME}", "Build ${BuildConfig.VERSION_CODE}", "Android", "Fan-made").forEach {
                        Txt(it.uppercase(), AppText.micro(Color.White, 9.5.sp), Modifier.background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 5.dp))
                    }
                }
            }
        }

        // Pembuat
        item { Section("Dibuat oleh", 1) }
        item {
            Column(Modifier.fillMaxWidth().appCard(26.dp).padding(18.dp).staggerIn(2)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(58.dp).background(c.brandGradient, CircleShape), contentAlignment = Alignment.Center) {
                        Txt("V", AppText.display(30.sp, Color.White))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Txt("Valzyys", AppText.display(24.sp, c.ink))
                        Txt("@Valzyys · Developer JKT48Connect", AppText.mono(12.sp, c.inkSoft))
                    }
                }
                VGap(14.dp)
                Txt(
                    "JKT48Connect dirancang, dibangun, dan dirawat oleh Valzyys: situs web, JKT48Connect API, bot X dan Discord, sampai aplikasi Android yang sedang kamu pakai ini. Dibuat dari fans, untuk fans JKT48.",
                    AppText.body(14.sp, c.ink, 500, 1.55f),
                )
                VGap(16.dp)
                LiquidButton(onClick = { open(CREATOR_X) }, modifier = Modifier.fillMaxWidth().height(48.dp), tint = c.brand) {
                    XGlyph(Color.White, 15.sp)
                    Txt("Ikuti @Valzyys di X", AppText.body(14.sp, Color.White, 800))
                }
            }
        }

        item {
            VGap(12.dp)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Color(0xFF2A0610), c.brand, Color(0xFFFF4D7D)))).pressable({ nav.push(Route.Donate) }).padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(Icons.Rounded.Favorite, null, Modifier.size(28.dp), colorFilter = ColorFilter.tint(Color.White))
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Txt("Dukung JKT48Connect", AppText.body(16.sp, Color.White, 800))
                    Txt("Donasi via QRIS untuk biaya server & fitur baru", AppText.body(12.5.sp, Color.White.copy(alpha = 0.85f)))
                }
                Image(Icons.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(Color.White))
            }
        }

        // Ekosistem
        item { Section("Ekosistem JKT48Connect", 3) }
        item {
            Txt(
                "Selain aplikasi ini, JKT48Connect juga hadir di web, X, dan Discord. Semuanya memakai data yang sama dari JKT48Connect API.",
                AppText.body(13.sp, c.inkSoft, 500, 1.5f),
                Modifier.padding(horizontal = 6.dp).padding(bottom = 12.dp),
            )
            Column(Modifier.staggerIn(4), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                ECOSYSTEM.chunked(2).forEach { row ->
                    Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { e -> EcoTile(e, Modifier.weight(1f).fillMaxHeight()) { open(e.url.ifEmpty { Api.base }) } }
                    }
                }
            }
        }

        // Fitur
        item { Section("Fitur aplikasi", 5) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(vertical = 6.dp).staggerIn(6)) {
                FEATURES.forEachIndexed { i, (icon, title, desc) ->
                    if (i > 0) Box(Modifier.padding(start = 66.dp, end = 16.dp).fillMaxWidth().height(1.dp).background(c.line))
                    Row(Modifier.padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(36.dp).background(c.brand.copy(alpha = 0.12f), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                            Image(icon, null, Modifier.size(19.dp), colorFilter = ColorFilter.tint(c.brand))
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

        item { Section("Versi", 7) }

        item {
            Row(Modifier.fillMaxWidth().appCard(22.dp).padding(16.dp).staggerIn(8), verticalAlignment = Alignment.CenterVertically) {
                val newer = Updater.available
                Column(Modifier.weight(1f)) {
                    Txt(if (newer != null) "Versi ${newer.version} tersedia" else "Versi ${Updater.current}", AppText.body(15.sp, c.ink, 800))
                    Txt(
                        when {
                            checking -> "Memeriksa update…"
                            newer != null -> "Versi kamu ${Updater.current}. Ketuk Update."
                            checkError -> "Tidak bisa memeriksa update. Coba lagi nanti."
                            checked -> "Sudah versi terbaru."
                            else -> "Update dicek otomatis dari GitHub Releases."
                        },
                        AppText.body(12.5.sp, c.inkSoft),
                    )
                }
                Spacer(Modifier.width(10.dp))
                LiquidButton(
                    onClick = {
                        if (newer != null) {
                            Updater.dialog = true
                        } else if (!checking) {
                            scope.launch {
                                checking = true
                                checkError = runCatching { Updater.check(context, force = true) }.isFailure
                                checked = true
                                checking = false
                            }
                        }
                    },
                    modifier = Modifier.height(40.dp),
                    tint = if (newer != null) c.brand else Color.Unspecified,
                    contentPadding = PaddingValues(horizontal = 14.dp),
                ) { Txt(if (newer != null) "Update" else "Periksa", AppText.body(13.sp, if (newer != null) Color.White else c.ink, 800)) }
            }
        }

        item { Section("Notifikasi", 9) }
        if (!permitted) item {
            Row(Modifier.fillMaxWidth().appCard(22.dp).padding(16.dp).staggerIn(2), verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.NotificationsActive, null, Modifier.size(24.dp), colorFilter = ColorFilter.tint(c.brand))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Txt("Notifikasi belum diizinkan", AppText.body(14.sp, c.ink, 800))
                    Txt("Izinkan agar aplikasi bisa memberi tahu saat member live.", AppText.body(12.sp, c.inkSoft))
                }
                Spacer(Modifier.width(10.dp))
                LiquidButton(
                    onClick = {
                        if (Build.VERSION.SDK_INT >= 33 && !Notify.askedOnce(context)) {
                            Notify.markAsked(context)
                            ask.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            // Sudah pernah ditolak → hanya bisa diubah dari pengaturan Android.
                            context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
                        }
                    },
                    modifier = Modifier.height(40.dp),
                    tint = c.brand,
                    contentPadding = PaddingValues(horizontal = 14.dp),
                ) { Txt("Izinkan", AppText.body(13.sp, Color.White, 800)) }
            }
            VGap(10.dp)
        }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).staggerIn(3)) {
                NotifyKind.entries.forEachIndexed { i, kind ->
                    if (i > 0) Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(1.dp).background(c.line))
                    Row(Modifier.padding(16.dp, 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Txt(kind.label, AppText.body(15.sp, c.ink, 800))
                            Txt(kind.hint, AppText.body(12.5.sp, c.inkSoft))
                        }
                        Spacer(Modifier.width(12.dp))
                        LiquidToggle(
                            checked = toggles[kind] == true,
                            onCheckedChange = {
                                toggles[kind] = it
                                Notify.setEnabled(context, kind, it)
                            },
                        )
                    }
                }
            }
            VGap(8.dp)
            Txt(
                if (Push.active(context)) "Realtime: server JKT48Connect mengecek tiap 15 detik dan langsung mengirim notifikasi, walau aplikasi tertutup."
                else "Diperiksa otomatis tiap ±15 menit saat ada internet. Penghemat baterai bisa membuat pemberitahuan sedikit terlambat.",
                AppText.body(12.sp, c.inkSoft),
                Modifier.padding(horizontal = 6.dp),
            )
        }

        item { Section("Tema · tarik pilnya", 10) }
        item {
            LiquidTabs(
                items = listOf(TabItem("Sistem"), TabItem("Putih"), TabItem("Gelap")),
                selectedIndex = ThemeController.mode.ordinal,
                onSelected = { ThemeController.set(ThemeMode.entries[it]) },
                height = 54.dp,
                modifier = Modifier.fillMaxWidth().staggerIn(5),
            )
        }

        item { Section("Sumber resmi", 11) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).staggerIn(7)) {
                listOf(
                    "Situs resmi JKT48" to "https://jkt48.com",
                    "Showroom" to "https://www.showroom-live.com",
                    "IDN Live" to "https://www.idn.app",
                ).forEachIndexed { i, (label, url) ->
                    if (i > 0) Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(1.dp).background(c.line))
                    Row(Modifier.fillMaxWidth().pressable({ open(url) }).padding(16.dp, 15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Txt(label, AppText.body(15.sp, c.ink, 700))
                            Txt(url.removePrefix("https://").removePrefix("www."), AppText.mono(11.5.sp, c.inkSoft))
                        }
                        Image(Icons.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
                    }
                }
            }
        }

        item { Section("Kredit", 12) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(16.dp).staggerIn(9), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(
                    "Data" to "jkt48.com, Showroom, dan IDN Live melalui API JKT48Connect",
                    "Pemutar video" to "AndroidX Media3 ExoPlayer · Apache License 2.0",
                    "Huruf" to "Archivo & IBM Plex Mono · SIL Open Font License",
                ).forEach { (k, v) ->
                    Column {
                        Txt(k.uppercase(), AppText.micro(c.brand, 9.5.sp))
                        VGap(3.dp)
                        Txt(v, AppText.body(13.5.sp, c.ink, 600))
                    }
                }
            }
        }

        item {
            VGap(18.dp)
            Txt(
                "JKT48Connect adalah proyek penggemar dan tidak berafiliasi dengan JKT48, IDN, maupun Showroom. Semua nama, foto, dan merek milik pemiliknya masing-masing.",
                AppText.body(12.sp, c.inkSoft, 500, 1.5f),
                Modifier.padding(horizontal = 6.dp),
            )
            VGap(22.dp)
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                PixelLogo(22.dp)
                VGap(10.dp)
                Row {
                    Txt("Dibuat dengan ", AppText.body(12.5.sp, c.inkSoft))
                    Txt("♥", AppText.body(12.5.sp, c.brand, 800))
                    Txt(" oleh ", AppText.body(12.5.sp, c.inkSoft))
                    Txt("@Valzyys", AppText.body(12.5.sp, c.brand, 800), Modifier.pressable({ open(CREATOR_X) }))
                }
                VGap(4.dp)
                Micro("Untuk fans JKT48 · © 2026 JKT48Connect")
            }
        }
    }
}

/** Huruf X (logo X tidak ada di set ikon Material). */
@Composable
private fun XGlyph(color: Color, size: androidx.compose.ui.unit.TextUnit) = Txt("X", AppText.display(size, color))

@Composable
private fun EcoTile(e: Eco, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Column(modifier.appCard(22.dp).pressable(onClick).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).background(c.brandGradient, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                if (e.icon != null) Image(e.icon, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(Color.White)) else XGlyph(Color.White, 18.sp)
            }
            Spacer(Modifier.weight(1f))
            Image(Icons.Rounded.OpenInNew, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(c.inkSoft))
        }
        VGap(12.dp)
        Txt(e.title, AppText.body(15.sp, c.ink, 800))
        Txt(e.handle, AppText.mono(11.sp, c.brand, androidx.compose.ui.text.font.FontWeight.SemiBold), maxLines = 1)
        VGap(6.dp)
        Txt(e.desc, AppText.body(12.sp, c.inkSoft, 500, 1.45f))
    }
}

@Composable
private fun Section(label: String, index: Int) {
    Micro(label, Modifier.padding(6.dp, 26.dp, 6.dp, 10.dp).staggerIn(index), color = LocalColors.current.brand, dot = true)
}
