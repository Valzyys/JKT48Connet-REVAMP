package app.jkt48connect.core

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import app.jkt48connect.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

class ApiException(val status: Int, override val message: String) : Exception(message)

/** Cara mengambil data: dari cache saja (untuk tampil instan), normal (cache memori bila masih segar), atau paksa jaringan. */
enum class Fetch { Cache, Normal, Force }

/**
 * Klien jalur aplikasi `/api/app`: token aplikasi (Bearer) diminta otomatis, disimpan, dan diperbarui saat ditolak (401).
 * Respons disimpan di memori dan di disk: halaman tampil seketika dari cache terakhir lalu diperbarui,
 * dan tetap bisa dibuka saat koneksi putus. Tanpa library HTTP tambahan.
 */
object Api {
    val base: String = BuildConfig.API_BASE

    private lateinit var prefs: SharedPreferences
    private lateinit var diskDir: File
    private var token: String? = null
    private val tokenLock = Mutex()
    private val cache = HashMap<String, Pair<Long, Any>>()

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.getSharedPreferences("app", Context.MODE_PRIVATE)
        diskDir = File(context.cacheDir, "api").apply { mkdirs() }
    }

    fun absolute(path: String) = if (path.startsWith("http")) path else base + path

    /** Gambar jkt48.com menolak hotlink, jadi dilewatkan proxy media worker (`/api/app/media`). */
    fun imageUrl(url: String): String {
        val abs = if (url.startsWith("//")) "https:$url" else if (url.startsWith("/")) "https://jkt48.com$url" else url
        val host = runCatching { Uri.parse(abs).host.orEmpty() }.getOrDefault("")
        return if (host == "jkt48.com" || host.endsWith(".jkt48.com")) "$base/api/app/media?url=${URLEncoder.encode(abs.replace("http://", "https://"), "UTF-8")}" else abs
    }

    /** Header untuk pemutar replay & gambar via worker — token yang sama dengan data. */
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

    private fun parse(text: String): Any? = runCatching { JSONTokener(text).nextValue() }.getOrNull()

    private fun decode(status: Int, text: String): Any {
        val body = parse(text)
        if (status >= 400) {
            val obj = body as? JSONObject
            // Diblokir penjaga anti-iseng situs: jelaskan sampai kapan, bukan sekadar "Akses diblokir".
            if (obj?.optString("code") == "blocked") {
                val until = obj.optLong("until").takeIf { it > 0 }?.let { fmtWib(java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneId.of("Asia/Jakarta")), "HH.mm") }
                val incident = obj.optString("incident").takeIf { it.isNotEmpty() }?.let { " · ID $it" } ?: ""
                throw ApiException(status, "Akses dari jaringanmu diblokir sementara oleh situs" + (until?.let { " sampai $it WIB" } ?: "") + ". Coba lagi nanti$incident.")
            }
            val msg = obj?.optString("message")?.takeIf { it.isNotEmpty() } ?: "Gagal memuat data ($status)"
            throw ApiException(status, msg)
        }
        return body ?: throw ApiException(status, "Respons tidak valid")
    }

    private fun diskFile(path: String) = File(diskDir, MessageDigest.getInstance("SHA-1").digest(path.toByteArray()).joinToString("") { "%02x".format(it) })

    private suspend fun fromDisk(path: String): Any? = withContext(Dispatchers.IO) {
        val f = diskFile(path)
        if (f.exists()) runCatching { parse(f.readText()) }.getOrNull() else null
    }

    private suspend fun get(path: String, ttlMs: Long = 60_000, fetch: Fetch = Fetch.Normal): Any {
        val now = System.currentTimeMillis()
        val mem = synchronized(cache) { cache[path] }
        if (fetch == Fetch.Cache) return mem?.second ?: fromDisk(path) ?: throw ApiException(0, "Belum ada cache")
        if (fetch == Fetch.Normal && mem != null && now - mem.first < ttlMs) return mem.second
        try {
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
            withContext(Dispatchers.IO) { runCatching { diskFile(path).writeText(text) } }
            return data
        } catch (e: ApiException) {
            // Koneksi putus: pakai data terakhir yang tersimpan.
            if (e.status == 0) (mem?.second ?: fromDisk(path))?.let { return it }
            throw e
        }
    }

    /** Permintaan tanpa cache (POST/GET) untuk aksi seperti donasi; token diperbarui sekali bila ditolak. */
    private suspend fun send(method: String, path: String, body: JSONObject? = null): JSONObject {
        var (status, text) = request("$base/api/app$path", method, body?.toString() ?: if (method == "POST") "{}" else null, ensureToken())
        if (status == 401) {
            tokenLock.withLock { token = null; prefs.edit().remove("app_token").apply() }
            val retry = request("$base/api/app$path", method, body?.toString() ?: if (method == "POST") "{}" else null, ensureToken())
            status = retry.first
            text = retry.second
        }
        return decode(status, text) as? JSONObject ?: throw ApiException(status, "Respons tidak valid")
    }

    private fun Any.list(): List<JSONObject> = (this as? JSONArray)?.objects() ?: emptyList()
    private fun Any.obj(): JSONObject = this as? JSONObject ?: JSONObject()
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    suspend fun live(f: Fetch = Fetch.Normal) = get("/now_live", 20_000, f).list().map(LiveSession::from)
    suspend fun members(f: Fetch = Fetch.Normal) = get("/member", 30 * 60_000, f).list().map(Member::from)
    suspend fun member(id: String, f: Fetch = Fetch.Normal) = MemberDetail.from(get("/member/${enc(id)}", 10 * 60_000, f).obj())
    suspend fun nextSchedule(f: Fetch = Fetch.Normal) = get("/next_schedule", 5 * 60_000, f).list().map(TheaterShow::from)
    suspend fun theater(page: Int, f: Fetch = Fetch.Normal) = Paged.parse(get("/theater?page=$page&perpage=12", 5 * 60_000, f).obj(), TheaterShow::from)
    suspend fun theaterDetail(id: String, f: Fetch = Fetch.Normal) = TheaterDetail.from(get("/theater/${enc(id)}", 10 * 60_000, f).obj())
    suspend fun recent(page: Int, f: Fetch = Fetch.Normal) = Paged.parse(get("/recent?page=$page&perpage=12", 3 * 60_000, f).obj(), RecentLive::from)
    suspend fun recentDetail(id: String, f: Fetch = Fetch.Normal) = RecentDetail.from(get("/recent/${enc(id)}", 3 * 60_000, f).obj())
    suspend fun news(page: Int, f: Fetch = Fetch.Normal) = Paged.parse(get("/news?page=$page&perpage=10", 10 * 60_000, f).obj(), NewsItem::from)
    suspend fun newsDetail(id: String, f: Fetch = Fetch.Normal) = NewsItem.from(get("/news/${enc(id)}", 60 * 60_000, f).obj())

    /** Detail member jarang memuat jadwal, jadi theater & live member diambil dari 3 halaman arsip terbaru (cache sama). */
    suspend fun memberActivity(id: String, f: Fetch = Fetch.Normal): MemberActivity = coroutineScope {
        val shows = (1..3).map { p -> async { runCatching { theater(p, f).items }.getOrNull() } }.awaitAll()
        val lives = (1..3).map { p -> async { runCatching { recent(p, f).items }.getOrNull() } }.awaitAll()
        // Tanpa satu halaman pun (cache kosong / offline) → gagal, supaya UI menampilkan kerangka, bukan "kosong".
        if ((shows + lives).all { it == null }) throw ApiException(0, "Belum ada data")
        val now = System.currentTimeMillis()
        val mine = shows.filterNotNull().flatten().filter { s -> s.members.any { it.id == id } }.distinctBy { it.id }
        val (up, past) = mine.partition { (parseInstant(it.date)?.toEpochMilli() ?: 0) > now }
        MemberActivity(up.sortedBy { it.date }, past.sortedByDescending { it.date }, lives.filterNotNull().flatten().filter { it.memberId == id }.distinctBy { it.id })
    }

    suspend fun donate(amount: Long, name: String) = Donation.from(send("POST", "/donate", JSONObject().put("amount", amount).put("name", name)))
    suspend fun donation(id: String) = Donation.from(send("GET", "/donate/${enc(id)}"))
    suspend fun cancelDonation(id: String) = Donation.from(send("POST", "/donate/${enc(id)}/cancel"))
    suspend fun supporters(f: Fetch = Fetch.Normal) = SupporterWall.from(get("/donate/wall", 60_000, f).obj())
    suspend fun pushConfig(f: Fetch = Fetch.Force) = get("/push", 6 * 3600_000, f).obj()
    suspend fun update(f: Fetch = Fetch.Normal) = AppUpdate.from(get("/update", 15 * 60_000, f).obj())
    suspend fun birthdays(f: Fetch = Fetch.Normal) = get("/next_birthday", 60 * 60_000, f).list().map(BirthdayEntry::from)

    suspend fun videos(f: Fetch = Fetch.Normal) = get("/jkt48_youtube", 3 * 60_000, f).list().map(Video::from)
    /** Detail video + playlist HLS bertiket. `Fetch.Force` saat tiket kedaluwarsa (pemutar gagal). */
    suspend fun video(id: String, f: Fetch = Fetch.Normal) = VideoDetail.from(get("/jkt48_youtube/${enc(id)}", 15 * 60_000, f).obj())
    suspend fun videoComments(id: String, cursor: String = "", f: Fetch = Fetch.Normal) =
        VideoComments.from(get("/jkt48_youtube/${enc(id)}/comments" + (if (cursor.isEmpty()) "" else "?cursor=${enc(cursor)}"), 2 * 60_000, f).obj())

    /** Posting member: `platform` = x, tiktok, atau instagram; `before` = cursor halaman berikutnya. */
    suspend fun social(platform: String, member: String = "", before: String = "", limit: Int = 20, f: Fetch = Fetch.Normal): SocialPage {
        val path = when (platform) {
            "x" -> "/x/tweets"
            "tiktok" -> "/tiktok/posts"
            else -> "/instagram/posts"
        }
        val q = listOfNotNull(member.takeIf { it.isNotEmpty() }?.let { "member=${enc(it)}" }, before.takeIf { it.isNotEmpty() }?.let { "before=$it" }, "limit=$limit")
        return SocialPage.from(get("$path?${q.joinToString("&")}", 2 * 60_000, f).obj())
    }
}
