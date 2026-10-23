package app.jkt48connect.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.PaddingValues
import app.jkt48connect.core.Fetch
import app.jkt48connect.core.NewsItem
import app.jkt48connect.core.Paged
import app.jkt48connect.core.RecentLive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Halaman di atas tab utama. */
sealed interface Route {
    data class Recent(val item: RecentLive) : Route
    data class Member(val id: String, val name: String, val img: String) : Route
    data class Theater(val id: String, val title: String) : Route
    data object Birthday : Route
    data object News : Route
    data class NewsDetail(val item: NewsItem) : Route
    data class Shots(val urls: List<String>, val start: Int) : Route
    data object About : Route
}

/** Navigasi sederhana tanpa library: tab utama + tumpukan halaman detail. */
@Stable
class Nav {
    var tab by mutableIntStateOf(0)
    val stack = mutableStateListOf<Route>()
    var menuOpen by mutableStateOf(false)

    fun push(r: Route) {
        stack.add(r)
    }

    fun pop(): Boolean {
        if (menuOpen) {
            menuOpen = false
            return true
        }
        if (stack.isEmpty()) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Tujuan dari notifikasi: "tab:1", "route:birthday", "theater:<id>|<judul>", "news:<id>|<tanggal>|<judul>". */
    fun open(target: String) {
        val kind = target.substringBefore(':')
        val rest = target.substringAfter(':')
        menuOpen = false
        stack.clear()
        when (kind) {
            "tab" -> tab = rest.toIntOrNull() ?: 0
            "route" -> when (rest) {
                "birthday" -> push(Route.Birthday)
                "news" -> push(Route.News)
                "about" -> push(Route.About)
            }
            "theater" -> push(Route.Theater(rest.substringBefore('|'), rest.substringAfter('|', "")))
            "news" -> rest.split('|', limit = 3).let { push(Route.NewsDetail(NewsItem(it[0], it.getOrElse(2) { "" }, it.getOrElse(1) { "" }, "", ""))) }
        }
    }
}

val LocalNav = staticCompositionLocalOf { Nav() }

/** Jarak isi dari kaca atas & bawah (sudah termasuk inset sistem). */
val LocalInsets = staticCompositionLocalOf { PaddingValues() }

/**
 * Status muat data: tampil seketika dari cache terakhir (memori/disk), lalu diperbarui dari jaringan.
 */
@Stable
class Load<T>(private val scope: CoroutineScope, private val block: suspend (Fetch) -> T) {
    var data by mutableStateOf<T?>(null)
        private set
    var error by mutableStateOf<Throwable?>(null)
        private set
    var loading by mutableStateOf(false)
        private set

    fun run(force: Boolean = false) {
        if (loading) return
        loading = true
        scope.launch {
            try {
                if (data == null) runCatching { block(Fetch.Cache) }.getOrNull()?.let { data = it }
                data = block(if (force) Fetch.Force else Fetch.Normal)
                error = null
            } catch (e: Throwable) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                error = e
            } finally {
                loading = false
            }
        }
    }

    suspend fun refresh() {
        try {
            data = block(Fetch.Force)
            error = null
        } catch (e: Throwable) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            error = e
        }
    }
}

@Composable
fun <T> rememberLoad(vararg keys: Any?, block: suspend (Fetch) -> T): Load<T> {
    val scope = rememberCoroutineScope()
    val load = remember(*keys) { Load(scope, block) }
    LaunchedEffect(load) { load.run() }
    return load
}

/** Daftar bertingkat halaman (recent, arsip theater, berita) dengan muat-lanjut; halaman 1 tampil dulu dari cache. */
@Stable
class PagedLoad<T>(private val scope: CoroutineScope, private val block: suspend (page: Int, fetch: Fetch) -> Paged<T>) {
    val items = mutableStateListOf<T>()
    var error by mutableStateOf<Throwable?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    private var page = 0
    var hasMore by mutableStateOf(true)
        private set

    fun more() {
        if (loading || !hasMore) return
        loading = true
        scope.launch {
            try {
                if (page == 0 && items.isEmpty()) runCatching { block(1, Fetch.Cache) }.getOrNull()?.let { items.addAll(it.items) }
                val p = block(page + 1, Fetch.Normal)
                if (page == 0) items.clear()
                items.addAll(p.items)
                page = p.page
                hasMore = p.hasMore
                error = null
            } catch (e: Throwable) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                error = e
            } finally {
                loading = false
            }
        }
    }

    suspend fun refresh() {
        try {
            val p = block(1, Fetch.Force)
            items.clear()
            items.addAll(p.items)
            page = p.page
            hasMore = p.hasMore
            error = null
        } catch (e: Throwable) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            error = e
        }
    }
}

@Composable
fun <T> rememberPaged(block: suspend (page: Int, fetch: Fetch) -> Paged<T>): PagedLoad<T> {
    val scope = rememberCoroutineScope()
    val load = remember { PagedLoad(scope, block) }
    LaunchedEffect(load) { load.more() }
    return load
}
