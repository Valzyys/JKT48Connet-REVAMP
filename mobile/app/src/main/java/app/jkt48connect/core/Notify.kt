package app.jkt48connect.core

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import app.jkt48connect.MainActivity
import app.jkt48connect.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Jenis notifikasi; masing-masing punya channel sendiri sehingga bisa diatur juga dari pengaturan Android. */
enum class NotifyKind(val key: String, val label: String, val hint: String) {
    Live("live", "Member live", "Saat member mulai live di Showroom / IDN"),
    Show("show", "Show dimulai", "Satu jam sebelum show theater & event"),
    Birthday("birthday", "Ulang tahun", "Pagi hari saat member berulang tahun"),
    News("news", "Berita baru", "Kabar terbaru dari jkt48.com"),
    Update("update", "Update aplikasi", "Saat versi baru JKT48Connect tersedia"),
}

/**
 * Notifikasi otomatis tanpa server push: JobScheduler memeriksa API tiap ±15 menit (butuh jaringan,
 * tetap terjadwal setelah reboot), lalu memberi tahu hal yang belum pernah diberitahukan.
 * ID yang sudah diberitahukan disimpan; pemeriksaan pertama hanya mencatat supaya tidak membanjiri.
 */
object Notify {
    private const val JOB_ID = 4848
    const val EXTRA_OPEN = "open"

    private lateinit var store: SharedPreferences

    private fun prefs(context: Context): SharedPreferences {
        if (!::store.isInitialized) store = context.applicationContext.getSharedPreferences("notify", Context.MODE_PRIVATE)
        return store
    }

    fun enabled(context: Context, kind: NotifyKind) = prefs(context).getBoolean("on_${kind.key}", true)

    fun setEnabled(context: Context, kind: NotifyKind, on: Boolean) {
        prefs(context).edit().putBoolean("on_${kind.key}", on).apply()
        schedule(context)
    }

    /** Izin notifikasi (Android 13+) sudah diberikan dan notifikasi aplikasi tidak dimatikan. */
    fun permitted(context: Context): Boolean {
        val granted = Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return granted && context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
    }

    /** Sudah pernah meminta izin di awal (supaya tidak ditanyakan tiap buka aplikasi). */
    fun askedOnce(context: Context) = prefs(context).getBoolean("asked", false)
    fun markAsked(context: Context) = prefs(context).edit().putBoolean("asked", true).apply()

    fun schedule(context: Context) {
        createChannels(context)
        val scheduler = context.getSystemService(JobScheduler::class.java)
        if (NotifyKind.entries.none { enabled(context, it) }) {
            scheduler.cancel(JOB_ID)
            return
        }
        if (scheduler.getPendingJob(JOB_ID) != null) return
        scheduler.schedule(
            JobInfo.Builder(JOB_ID, ComponentName(context, NotifyJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(15 * 60_000L)
                .setPersisted(true)
                .build(),
        )
    }

    private fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        NotifyKind.entries.forEach { k ->
            val importance = if (k == NotifyKind.Live || k == NotifyKind.Show) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
            nm.createNotificationChannel(NotificationChannel(k.key, k.label, importance).apply { description = k.hint })
        }
    }

    private fun seen(key: String): Set<String>? = store.getStringSet("seen_$key", null)
    /** Simpan ID terbaru; ID lama hanya mengisi sisa kuota (set tidak berurutan, jadi yang baru jangan sampai terbuang). */
    private fun remember(key: String, fresh: Collection<String>, older: Collection<String> = emptyList(), keep: Int = 80) =
        store.edit().putStringSet("seen_$key", (fresh + older.filterNot { it in fresh }.take((keep - fresh.size).coerceAtLeast(0))).toSet()).apply()

    suspend fun check(context: Context) {
        prefs(context)
        Api.init(context)
        Images.init(context)
        createChannels(context)
        val now = System.currentTimeMillis()

        if (enabled(context, NotifyKind.Live)) runCatching {
            val lives = Api.live(Fetch.Force)
            val key = { l: LiveSession -> "${l.id}|${l.startedAt}" }
            val before = seen("live")
            if (before != null) lives.filter { key(it) !in before }.take(4).forEach { l ->
                post(context, NotifyKind.Live, key(l), "${l.name} sedang live", l.title.ifEmpty { "Live di ${l.platformLabel}" } + " · ${l.platformLabel}", "tab:1", l.photo)
            }
            // Cukup simpan sesi yang masih berjalan, supaya daftar tidak terus membesar.
            remember("live", lives.map(key))
        }

        if (enabled(context, NotifyKind.Show)) runCatching {
            val shows = (Api.nextSchedule() + runCatching { Api.theater(1).items }.getOrDefault(emptyList())).distinctBy { it.id }
            val before = seen("show").orEmpty()
            val soon = shows.filter { s ->
                val start = parseInstant(s.date)?.toEpochMilli() ?: return@filter false
                start - now in 0..65 * 60_000L && s.id !in before
            }
            soon.take(3).forEach { s ->
                val who = s.team.ifEmpty { if (s.members.isNotEmpty()) "${s.members.size} member tampil" else "" }
                post(context, NotifyKind.Show, s.id, "${s.title} dimulai ${fmtTime(s.date)} WIB", listOf("Show akan segera dimulai", who).filter { it.isNotEmpty() }.joinToString(" · "), "theater:${s.id}|${s.title}", s.banner.ifEmpty { s.poster }, big = true)
            }
            if (soon.isNotEmpty()) remember("show", soon.map { it.id }, before, 40)
        }

        // Ulang tahun diberitahukan mulai pukul 07.00 WIB, sekali per member per tahun.
        if (enabled(context, NotifyKind.Birthday) && nowWib().hour >= 7) runCatching {
            val year = nowWib().year
            val before = seen("birthday").orEmpty()
            val today = Api.birthdays().filter { daysUntil(it.birthdate) == 0 && "${it.id}-$year" !in before }
            today.forEach { b ->
                val age = parseWib(b.birthdate)?.year?.let { year - it }
                post(context, NotifyKind.Birthday, "${b.id}-$year", "Selamat ulang tahun, ${b.name}! 🎂", if (age != null && age in 10..60) "Hari ini ${b.name} berulang tahun ke-$age." else "Hari ini ${b.name} berulang tahun.", "route:birthday", b.img)
            }
            if (today.isNotEmpty()) remember("birthday", today.map { "${it.id}-$year" }, before, 60)
        }

        if (enabled(context, NotifyKind.News)) runCatching {
            val news = Api.news(1, Fetch.Force).items
            val before = seen("news")
            if (before != null) news.filter { it.id !in before }.take(3).forEach { n ->
                post(context, NotifyKind.News, n.id, n.title, "Berita ${n.category.ifEmpty { "baru" }} · jkt48.com", "news:${n.id}|${n.date}|${n.title}", null)
            }
            remember("news", news.map { it.id }, before.orEmpty(), 60)
        }

        // Versi baru diberitahukan sekali per versi; pop-up di aplikasi muncul saat dibuka.
        if (enabled(context, NotifyKind.Update)) runCatching { checkUpdate(context) }
    }

    private suspend fun checkUpdate(context: Context) {
        val u = Updater.check(context, prompt = false) ?: return
        val before = seen("update").orEmpty()
        if (u.version in before) return
        post(context, NotifyKind.Update, "update-${u.version}", "Update JKT48Connect ${u.version} tersedia", "Versi kamu ${Updater.current}. Ketuk untuk memperbarui.", "update", null)
        remember("update", listOf(u.version), before, 10)
    }

    private suspend fun post(context: Context, kind: NotifyKind, id: String, title: String, text: String, open: String, image: String?, big: Boolean = false) {
        if (!permitted(context)) return
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_OPEN, open)
        val pending = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val photo: Bitmap? = image?.takeIf { it.isNotEmpty() }?.let { runCatching { Images.load(it, if (big) 720 else 256) }.getOrNull() }
        val b = Notification.Builder(context, kind.key)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(0xFFE1243A.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setGroup(kind.key)
            .setCategory(if (kind == NotifyKind.News) Notification.CATEGORY_RECOMMENDATION else Notification.CATEGORY_EVENT)
        when {
            photo != null && big -> b.setLargeIcon(photo).setStyle(Notification.BigPictureStyle().bigPicture(photo).bigLargeIcon(null as android.graphics.drawable.Icon?))
            photo != null -> b.setLargeIcon(photo).setStyle(Notification.BigTextStyle().bigText(text))
            else -> b.setStyle(Notification.BigTextStyle().bigText(text))
        }
        context.getSystemService(NotificationManager::class.java).notify(kind.key, id.hashCode(), b.build())
    }
}

/** Pekerjaan berkala dari JobScheduler; berjalan di coroutine IO dan selesai sendiri. */
class NotifyJob : JobService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var running: Job? = null

    override fun onStartJob(params: JobParameters): Boolean {
        running = scope.launch {
            try {
                Notify.check(applicationContext)
            } finally {
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        running?.cancel()
        return true
    }
}
