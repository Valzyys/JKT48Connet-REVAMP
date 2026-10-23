package app.jkt48connect.core

import org.json.JSONArray
import org.json.JSONObject

// Model data — bentuknya sama dengan hasil normalisasi worker (`src/lib/shape.ts`).

private fun JSONObject.s(key: String): String = optString(key, "").let { if (isNull(key)) "" else it }
private fun JSONObject.n(key: String): Int? = if (has(key) && !isNull(key)) (opt(key) as? Number)?.toInt() else null
private fun JSONObject.b(key: String): Boolean = optBoolean(key, false)
private fun JSONObject.objs(key: String): List<JSONObject> = (optJSONArray(key) ?: JSONArray()).objects()

fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }

private fun platformLabel(platform: String) = when (platform) {
    "idn" -> "IDN Live"
    "showroom" -> "Showroom"
    else -> platform
}

data class Paged<T>(val items: List<T>, val page: Int, val perpage: Int, val total: Int) {
    val hasMore: Boolean get() = page * perpage < total

    companion object {
        fun <T> parse(j: JSONObject, map: (JSONObject) -> T) =
            Paged(j.objs("items").map(map), j.n("page") ?: 1, j.n("perpage") ?: 12, j.n("total") ?: 0)
    }
}

open class Member(val id: String, val name: String, val nickname: String, val img: String, val isGraduate: Boolean) {
    val shortName: String get() = nickname.ifEmpty { name.substringBefore(' ') }

    companion object {
        fun from(j: JSONObject) = Member(j.s("id"), j.s("name"), j.s("nickname"), j.s("img"), j.b("isGraduate"))
    }
}

data class Social(val title: String, val url: String)

class MemberDetail(
    m: Member,
    val fullname: String,
    val birthdate: String,
    val bloodType: String,
    val height: String,
    val jikosokai: String,
    val socials: List<Social>,
    val upcomingShows: List<TheaterShow>,
    val recentShows: List<TheaterShow>,
    val totalShowroom: Int?,
    val totalIdn: Int?,
) : Member(m.id, m.name, m.nickname, m.img, m.isGraduate) {
    companion object {
        fun from(j: JSONObject): MemberDetail {
            val total = j.optJSONObject("totalLive")
            return MemberDetail(
                Member.from(j),
                j.s("fullname"), j.s("birthdate"), j.s("bloodType"), j.s("height"), j.s("jikosokai"),
                j.objs("socials").map { Social(it.s("title"), it.s("url")) }.filter { it.url.isNotEmpty() },
                j.objs("upcomingShows").map(TheaterShow::from),
                j.objs("recentShows").map(TheaterShow::from),
                total?.n("showroom"), total?.n("idn"),
            )
        }
    }
}

/** Rilis aplikasi terbaru dari GitHub Releases (lewat `/api/app/update`). */
data class AppUpdate(val version: String, val name: String, val notes: String, val page: String, val apk: String, val size: Long, val publishedAt: String) {
    companion object {
        fun from(j: JSONObject) = AppUpdate(j.s("version"), j.s("name"), j.s("notes"), j.s("page"), j.s("apk"), (j.n("size") ?: 0).toLong(), j.s("publishedAt"))
    }
}

/** Theater & live seorang member, dikumpulkan dari arsip theater dan riwayat live terbaru. */
data class MemberActivity(val upcoming: List<TheaterShow>, val pastShows: List<TheaterShow>, val lives: List<RecentLive>)

data class LiveSession(
    val id: String, val name: String, val img: String, val avatar: String, val platform: String,
    val startedAt: String, val title: String, val link: String, val banner: String,
) {
    val platformLabel: String get() = platformLabel(platform)
    val photo: String get() = banner.ifEmpty { img.ifEmpty { avatar } }

    companion object {
        fun from(j: JSONObject) = LiveSession(
            j.s("id"), j.s("name"), j.s("img"), j.s("avatar"), j.s("platform"),
            j.s("startedAt"), j.s("title"), j.s("link"), j.s("banner"),
        )
    }
}

data class ShowMember(val id: String, val name: String, val img: String) {
    companion object {
        fun from(j: JSONObject) = ShowMember(j.s("id"), j.s("name"), j.s("img"))
    }
}

open class TheaterShow(
    val id: String, val title: String, val date: String, val team: String, val category: String,
    val banner: String, val poster: String, val members: List<ShowMember>,
) {
    companion object {
        fun from(j: JSONObject) = TheaterShow(
            j.s("id"), j.s("title"), j.s("date"), j.s("team"), j.s("category"),
            j.s("banner"), j.s("poster"), j.objs("members").map(ShowMember::from),
        )
    }
}

class TheaterDetail(s: TheaterShow, val songs: List<String>) :
    TheaterShow(s.id, s.title, s.date, s.team, s.category, s.banner, s.poster, s.members) {
    companion object {
        fun from(j: JSONObject): TheaterDetail {
            val songs = j.optJSONArray("songs") ?: JSONArray()
            return TheaterDetail(TheaterShow.from(j), (0 until songs.length()).mapNotNull { songs.opt(it) as? String })
        }
    }
}

data class NewsItem(val id: String, val title: String, val date: String, val category: String, val url: String, val content: String = "") {
    companion object {
        fun from(j: JSONObject) = NewsItem(j.s("id"), j.s("title"), j.s("date"), j.s("category"), j.s("url"), j.s("content"))
    }
}

data class BirthdayEntry(val id: String, val name: String, val img: String, val birthdate: String) {
    companion object {
        fun from(j: JSONObject) = BirthdayEntry(j.s("id"), j.s("name"), j.s("img"), j.s("birthdate"))
    }
}

open class RecentLive(
    val id: String, val name: String, val memberId: String, val img: String, val platform: String, val start: String, val end: String,
    val durationMs: Long, val viewers: Int?, val points: Int?, val pointUnit: String,
) {
    val platformLabel: String get() = platformLabel(platform)
    val pointLabel: String get() = if (pointUnit.contains("gold")) "Gold" else "Poin"

    companion object {
        fun from(j: JSONObject) = RecentLive(
            j.s("id"), j.s("name"), j.s("memberId"), j.s("img"), j.s("platform"), j.s("start"), j.s("end"),
            (j.n("durationMs") ?: 0).toLong(), j.n("viewers"), j.n("points"), j.s("pointUnit"),
        )
    }
}

data class Recording(val url: String, val hls: String?, val durationMs: Long)
data class Gift(val name: String, val img: String, val num: Int?)
data class Fan(val name: String, val avatar: String, val amount: Int?)

class RecentDetail(
    r: RecentLive,
    val gifts: List<Gift>,
    val fans: List<Fan>,
    val comments: Int?,
    val recordings: List<Recording>,
    val recordingCount: Int,
    val replayUnlockAt: String,
    val screenshots: List<String>,
) : RecentLive(r.id, r.name, r.memberId, r.img, r.platform, r.start, r.end, r.durationMs, r.viewers, r.points, r.pointUnit) {
    companion object {
        fun from(j: JSONObject) = RecentDetail(
            RecentLive.from(j),
            j.objs("gifts").map { Gift(it.s("name"), it.s("img"), it.n("num")) },
            j.objs("fans").map { Fan(it.s("name"), it.s("avatar"), it.n("amount")) },
            j.n("comments"),
            j.objs("recordings").map { Recording(it.s("url"), it.s("hls").ifEmpty { null }, (it.n("durationMs") ?: 0).toLong()) },
            j.n("recordingCount") ?: 0,
            j.s("replayUnlockAt"),
            j.objs("screenshots").map { it.s("url") }.filter { it.isNotEmpty() },
        )
    }
}
