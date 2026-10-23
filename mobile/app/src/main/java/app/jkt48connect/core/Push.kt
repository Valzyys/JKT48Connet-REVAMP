package app.jkt48connect.core

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Server push dari worker (cron Cloudflare → FCM, lihat worker/push.ts).
 * Konfigurasi Firebase diambil dari `/api/app/push` saat aplikasi dibuka (tidak ditanam di APK) dan disimpan,
 * lalu aplikasi berlangganan topik `jkc-<jenis>` sesuai sakelar notifikasi. Selama push aktif, pemeriksaan
 * berkala JobScheduler dimatikan; bila push tidak tersedia (belum diatur di worker / tanpa Google Play services),
 * aplikasi kembali ke pemeriksaan berkala.
 */
object Push {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("push", Context.MODE_PRIVATE)

    fun active(context: Context) = prefs(context).getBoolean("active", false)

    private fun config(context: Context): JSONObject? =
        prefs(context).getString("config", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    /** Dipanggil di Application.onCreate: Firebase harus siap sebelum pesan push diterima saat proses baru dibuat. */
    fun initCached(context: Context) {
        config(context)?.let { ensureApp(context, it) }
    }

    private fun ensureApp(context: Context, cfg: JSONObject): Boolean = runCatching {
        if (FirebaseApp.getApps(context).isEmpty()) {
            FirebaseApp.initializeApp(
                context.applicationContext,
                FirebaseOptions.Builder()
                    .setApplicationId(cfg.getString("appId"))
                    .setApiKey(cfg.getString("apiKey"))
                    .setProjectId(cfg.getString("projectId"))
                    .setGcmSenderId(cfg.getString("senderId"))
                    .build(),
            )
        }
        true
    }.getOrDefault(false)

    /** Saat aplikasi dibuka: ambil konfigurasi, siapkan Firebase, sinkronkan topik, lalu atur pemeriksaan berkala. */
    suspend fun setup(context: Context) {
        val ctx = context.applicationContext
        val cfg = runCatching { Api.pushConfig() }.getOrNull()
        if (cfg != null) {
            if (!cfg.optBoolean("enabled")) {
                prefs(ctx).edit().remove("config").putBoolean("active", false).apply()
            } else {
                prefs(ctx).edit().putString("config", cfg.toString()).apply()
                val ok = ensureApp(ctx, cfg) && runCatching {
                    withTimeout(20_000) {
                        FirebaseMessaging.getInstance().token.await()
                        syncTopics(ctx)
                    }
                }.isSuccess
                prefs(ctx).edit().putBoolean("active", ok).apply()
            }
        }
        // Offline (cfg null): status terakhir dipakai apa adanya.
        Notify.schedule(ctx)
    }

    /** Berlangganan/berhenti topik sesuai sakelar di halaman Tentang. */
    suspend fun syncTopics(context: Context) {
        val cfg = config(context) ?: return
        if (FirebaseApp.getApps(context).isEmpty()) return
        val prefix = cfg.optString("topicPrefix", "jkc-")
        val fm = FirebaseMessaging.getInstance()
        NotifyKind.entries.forEach { k ->
            val topic = prefix + k.key
            (if (Notify.enabled(context, k)) fm.subscribeToTopic(topic) else fm.unsubscribeFromTopic(topic)).await()
        }
    }

    fun syncTopicsLater(context: Context) {
        if (!active(context)) return
        scope.launch { runCatching { syncTopics(context.applicationContext) } }
    }

    private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { c ->
        addOnCompleteListener { t ->
            if (t.isSuccessful) c.resume(t.result) else c.resumeWithException(t.exception ?: IllegalStateException("Task gagal"))
        }
    }
}

/** Penerima pesan FCM: pesan data dari worker disusun jadi notifikasi oleh [Notify.fromPush]. */
class PushService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        // Dipanggil di thread latar dengan batas waktu ±10 detik.
        runBlocking { withTimeoutOrNull(9_000) { runCatching { Notify.fromPush(applicationContext, message.data) } } }
    }

    override fun onNewToken(token: String) {
        Push.syncTopicsLater(applicationContext)
    }
}
