package app.jkt48connect.core

import android.content.Context
import android.content.SharedPreferences
import app.jkt48connect.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val status: Int, override val message: String) : Exception(message)

/**
 * Klien jalur aplikasi `/api/app`: token aplikasi (Bearer) diminta otomatis, disimpan, dan diperbarui saat ditolak (401).
 * Respons disimpan sebentar di memori supaya pindah tab tidak memuat ulang. Tanpa library HTTP tambahan.
 */
object Api {
    val base: String = BuildConfig.API_BASE

    private lateinit var prefs: SharedPreferences
    private var token: String? = null
    private val tokenLock = Mutex()
    private val cache = HashMap<String, Pair<Long, Any>>()

    fun init(context: Context) {
        prefs = context.getSharedPreferences("app", Context.MODE_PRIVATE)
    }

    fun absolute(path: String) = if (path.startsWith("http")) path else base + path

    /** Header untuk pemutar replay — token yang sama dengan data. */
    suspend fun authHeaders(): Map<String, String> = mapOf("Authorization" to "Bearer ${ensureToken()}")

    private suspend fun ensureToken(): String = tokenLock.withLock {
        token?.let { return it }
        val saved = prefs.getString("app_token", null)
        val exp = prefs.getLong("app_token_exp", 0)
        if (saved != null && exp > System.currentTimeMillis() / 1000 + 3600) return saved.also { token = it }
        val (status, body) = request("$base/api/app/session", method = "POST", body = "{}")
        val obj = decode(status, body) as? JSONObject ?: throw ApiException(status, "Token tidak valid")
        val t = obj.getString("token")
        prefs.edit().putString("app_token", t).putLong("app_token_exp", obj.optLong("exp")).apply()
        token = t
        t
    }

    private suspend fun request(url: String, method: String = "GET", body: String? = null, auth: String? = null): Pair<Int, String> =
        withContext(Dispatchers.IO) {
            val conn = URL(url).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 15_000
                conn.readTimeout = 20_000
                conn.setRequestProperty("Accept", "application/json")
                auth?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(body.toByteArray()) }
                }
                val status = conn.responseCode
                val stream = if (status >= 400) conn.errorStream else conn.inputStream
                status to (stream?.bufferedReader()?.use { it.readText() } ?: "")
            } catch (e: IOException) {
                throw ApiException(0, "Tidak bisa terhubung. Periksa koneksi internet.")
            } finally {
                conn.disconnect()
            }
        }

    private fun decode(status: Int, text: String): Any {
        val body = runCatching { JSONTokener(text).nextValue() }.getOrNull()
        if (status >= 400) {
            val msg = (body as? JSONObject)?.optString("message")?.takeIf { it.isNotEmpty() } ?: "Gagal memuat data ($status)"
            throw ApiException(status, msg)
        }
        return body ?: throw ApiException(status, "Respons tidak valid")
    }

    private suspend fun get(path: String, ttlMs: Long = 60_000, force: Boolean = false): Any {
        val now = System.currentTimeMillis()
        if (!force) synchronized(cache) { cache[path] }?.let { (at, data) -> if (now - at < ttlMs) return data }
        var (status, text) = request("$base/api/app$path", auth = ensureToken())
        if (status == 401) {
            // Token kedaluwarsa/diganti server → minta baru sekali, lalu ulangi.
            tokenLock.withLock { token = null; prefs.edit().remove("app_token").apply() }
            val retry = request("$base/api/app$path", auth = ensureToken())
            status = retry.first
            text = retry.second
        }
        val data = decode(status, text)
        synchronized(cache) { cache[path] = now to data }
        return data
    }

    private fun Any.list(): List<JSONObject> = (this as? JSONArray)?.objects() ?: emptyList()
    private fun Any.obj(): JSONObject = this as? JSONObject ?: JSONObject()
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    suspend fun live(force: Boolean = false) = get("/now_live", 20_000, force).list().map(LiveSession::from)
    suspend fun members(force: Boolean = false) = get("/member", 30 * 60_000, force).list().map(Member::from)
    suspend fun member(id: String) = MemberDetail.from(get("/member/${enc(id)}").obj())
    suspend fun nextSchedule(force: Boolean = false) = get("/next_schedule", 5 * 60_000, force).list().map(TheaterShow::from)
    suspend fun theater(page: Int, force: Boolean = false) = Paged.parse(get("/theater?page=$page&perpage=12", force = force).obj(), TheaterShow::from)
    suspend fun theaterDetail(id: String) = TheaterDetail.from(get("/theater/${enc(id)}").obj())
    suspend fun recent(page: Int, force: Boolean = false) = Paged.parse(get("/recent?page=$page&perpage=12", force = force).obj(), RecentLive::from)
    suspend fun recentDetail(id: String, force: Boolean = false) = RecentDetail.from(get("/recent/${enc(id)}", force = force).obj())
    suspend fun news(page: Int, force: Boolean = false) = Paged.parse(get("/news?page=$page&perpage=10", force = force).obj(), NewsItem::from)
    suspend fun newsDetail(id: String) = NewsItem.from(get("/news/${enc(id)}").obj())
    suspend fun birthdays(force: Boolean = false) = get("/next_birthday", 60 * 60_000, force).list().map(BirthdayEntry::from)
}
