package app.jkt48connect.stream

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.LruCache
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** App/server boundary follows mobile 2.6.1. Upstream keys stay on server. */
object StreamApi {
    val base = BuildConfig.API_BASE
    lateinit var context: Context
    var token by mutableStateOf("")
        private set
    private val prefs get() = context.getSharedPreferences("stream-private", Context.MODE_PRIVATE)
    var onboarded: Boolean
        get() = prefs.getBoolean("onboarded", false)
        set(value) { prefs.edit().putBoolean("onboarded", value).apply() }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("stream-session", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("stream-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun init(ctx: Context) {
        context = ctx.applicationContext
        token = runCatching {
            val encrypted = prefs.getString("session", null) ?: return@runCatching ""
            val bytes = Base64.decode(encrypted, Base64.NO_WRAP)
            Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
                .doFinal(bytes.copyOfRange(12, bytes.size)).decodeToString()
        }.getOrDefault("")
    }
    private fun save(value: String) {
        token = value
        if (value.isEmpty()) { prefs.edit().remove("session").apply(); return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        prefs.edit().putString("session", Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray()), Base64.NO_WRAP)).apply()
    }
    /** `image`: kirim JPEG mentah (unggah foto profil) sebagai ganti body JSON. */
    suspend fun request(path: String, method: String = "GET", body: JSONObject? = null, image: ByteArray? = null): JSONObject = withContext(Dispatchers.IO) {
        val conn = URL("$base/api/app$path").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method; conn.connectTimeout = 15_000; conn.readTimeout = 28_000; conn.instanceFollowRedirects = false
            conn.setRequestProperty("Accept", "application/json")
            if (token.isNotEmpty()) conn.setRequestProperty("Authorization", "Bearer $token")
            if (method == "POST") {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", if (image != null) "image/jpeg" else "application/json")
                conn.outputStream.use { it.write(image ?: (body ?: JSONObject()).toString().toByteArray()) }
            }
            // Gangguan jaringan (tanpa sinyal, DNS, proxy) ditampilkan sebagai pesan yang bisa dipahami, bukan teks Java mentah.
            val status = try { conn.responseCode } catch (e: java.io.IOException) { throw Exception("Koneksi bermasalah. Periksa internet lalu coba lagi.") }
            val text = (if (status >= 400) conn.errorStream else conn.inputStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = runCatching { JSONObject(text) }.getOrElse { throw Exception("Layanan belum dapat dihubungi. Coba lagi sebentar.") }
            if (status == 401 && !path.startsWith("/auth/")) save("")
            if (status !in 200..299) throw Exception(result.optString("message").ifBlank {
                when (status) {
                    400, 422 -> "Data yang dikirim belum lengkap atau tidak valid. Periksa kembali isianmu."
                    429 -> "Terlalu banyak percobaan. Coba beberapa saat lagi."
                    in 500..599 -> "Server sedang bermasalah. Coba lagi sebentar."
                    else -> "Permintaan belum berhasil ($status)."
                }
            })
            result
        } finally { conn.disconnect() }
    }
    suspend fun auth(email: String, password: String, name: String, register: Boolean) {
        val result = request(if (register) "/auth/register" else "/auth/login", "POST", JSONObject().put("email", email).put("password", password).put("name", name))
        save(result.getString("token"))
    }
    suspend fun logout() { try { request("/auth/logout", "POST") } finally { save("") } }
    private val images = object : LruCache<String, android.graphics.Bitmap>(24 * 1024 * 1024) { override fun sizeOf(key: String, value: android.graphics.Bitmap) = value.byteCount }
    suspend fun bitmap(url: String) = withContext(Dispatchers.IO) {
        images.get(url)?.let { return@withContext it }
        require(url.startsWith("https://"))
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 12_000; conn.readTimeout = 15_000
            if (url.startsWith("$base/")) conn.setRequestProperty("Authorization", "Bearer $token")
            val bytes = conn.inputStream.use { stream ->
                val out = java.io.ByteArrayOutputStream(); val chunk = ByteArray(16384)
                while (true) { val n = stream.read(chunk); if (n < 0) break; require(out.size() + n <= 12 * 1024 * 1024); out.write(chunk, 0, n) }
                out.toByteArray()
            }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            var sample = 1; while (bounds.outWidth / sample > 1400 || bounds.outHeight / sample > 1400) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = android.graphics.Bitmap.Config.RGB_565 }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.also { images.put(url, it) }
        } finally { conn.disconnect() }
    }
    fun notify(id: Int, title: String, text: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("stream-info", "Pembayaran & aplikasi", NotificationManager.IMPORTANCE_DEFAULT))
        val intent = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = android.app.Notification.Builder(context, "stream-info").setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(title).setContentText(text).setContentIntent(intent).setAutoCancel(true).build()
        runCatching { manager.notify(id, notification) }
    }
}
