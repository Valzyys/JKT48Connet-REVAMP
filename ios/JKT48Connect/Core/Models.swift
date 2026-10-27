import CoreGraphics
import Foundation

/// Model data aplikasi; nama field mengikuti respons `/api/app/*` (src/lib/shape.ts), sama dengan klien Android.

func platformLabel(_ p: String) -> String {
    switch p {
    case "idn": return "IDN Live"
    case "showroom": return "Showroom"
    default: return p.isEmpty ? "Live" : p.capitalized
    }
}

struct LiveStream: Hashable {
    let label: String
    let quality: Int
    let url: String

    /// "original quality" → "Asli", "Medium quality" → "Sedang", "low quality" → "Rendah".
    var shortLabel: String {
        let l = label.lowercased()
        if l.contains("original") || l.contains("high") { return "Asli" }
        if l.contains("medium") { return "Sedang" }
        if l.contains("low") { return "Rendah" }
        return label.isEmpty ? "Auto" : label
    }
}

struct LiveSession: Identifiable, Hashable {
    let id, name, fullname, img, avatar, platform, startedAt, title, link, banner: String
    /// Stream HLS, kualitas tertinggi dulu. Hanya Showroom; live IDN selalu kosong → dibuka di idn.app.
    let streams: [LiveStream]

    init(_ j: J) {
        id = j.s("id"); name = j.s("name"); fullname = j.s("fullname"); img = j.s("img"); avatar = j.s("avatar")
        platform = j.s("platform"); startedAt = j.s("startedAt"); title = j.s("title"); link = j.s("link"); banner = j.s("banner")
        streams = j.objs("streams").map { LiveStream(label: $0.s("label"), quality: $0.n("quality") ?? 0, url: $0.s("url")) }.filter { $0.url.hasPrefix("https://") }
    }

    var watchable: Bool { !streams.isEmpty }
    var photo: String { banner.isEmpty ? (img.isEmpty ? avatar : img) : banner }
    var displayName: String { fullname.isEmpty ? name : fullname }
}

struct ShowMember: Identifiable, Hashable {
    let id, name, img: String
    init(_ j: J) { id = j.s("id"); name = j.s("name"); img = j.s("img") }
}

struct TheaterShow: Identifiable, Hashable {
    let id, title, date, team, category, banner, poster, url: String
    let memberCount: Int?
    let members: [ShowMember]
    let birthday: [ShowMember]

    init(_ j: J) {
        id = j.s("id"); title = j.s("title"); date = j.s("date"); team = j.s("team"); category = j.s("category")
        banner = j.s("banner"); poster = j.s("poster"); url = j.s("url"); memberCount = j.n("memberCount")
        members = j.objs("members").map(ShowMember.init); birthday = j.objs("birthday").map(ShowMember.init)
    }

    var image: String { banner.isEmpty ? poster : banner }
}

struct TheaterDetail {
    let show: TheaterShow
    let songs: [String]
    let graduation: [ShowMember]

    init(_ j: J) {
        show = TheaterShow(j); songs = j.strings("songs"); graduation = j.objs("graduation").map(ShowMember.init)
    }
}

struct Member: Identifiable, Hashable {
    let id, name, nickname, img, idnUsername: String
    let isGraduate: Bool
    init(_ j: J) {
        id = j.s("id"); name = j.s("name"); nickname = j.s("nickname"); img = j.s("img")
        idnUsername = j.s("idnUsername"); isGraduate = j.b("isGraduate")
    }
}

struct MemberDetail {
    let member: Member
    let fullname, birthdate, bloodType, height, description, jikosokai: String
    let socials: [(title: String, url: String)]
    let upcomingShows: [TheaterShow]
    let recentShows: [TheaterShow]
    let totalShowroom: Int?
    let totalIdn: Int?

    init(_ j: J) {
        member = Member(j); fullname = j.s("fullname"); birthdate = j.s("birthdate"); bloodType = j.s("bloodType")
        height = j.s("height"); description = j.s("description"); jikosokai = j.s("jikosokai")
        socials = j.objs("socials").map { (title: $0.s("title"), url: $0.s("url")) }.filter { $0.url.hasPrefix("http") }
        upcomingShows = j.objs("upcomingShows").map(TheaterShow.init); recentShows = j.objs("recentShows").map(TheaterShow.init)
        totalShowroom = j.obj("totalLive")?.n("showroom"); totalIdn = j.obj("totalLive")?.n("idn")
    }
}

struct RecentLive: Identifiable, Hashable {
    let id, name, memberId, img, platform, start, end, pointUnit, title: String
    let durationMs: Int
    let viewers: Int?
    let points: Int?

    init(_ j: J) {
        id = j.s("id"); name = j.s("name"); memberId = j.s("memberId"); img = j.s("img"); platform = j.s("platform")
        start = j.s("start"); end = j.s("end"); pointUnit = j.s("pointUnit"); title = j.s("title")
        durationMs = j.n("durationMs") ?? 0; viewers = j.n("viewers"); points = j.n("points")
    }

    var pointLabel: String { pointUnit.contains("gold") ? "Gold" : "Poin" }
}

struct Recording: Hashable {
    let url: String
    let hls: String
    let durationMs: Int
    init(_ j: J) { url = j.s("url"); hls = j.s("hls"); durationMs = j.n("durationMs") ?? 0 }
}

struct Fan: Hashable {
    let name, avatar: String
    let amount: Int?
    init(_ j: J) { name = j.s("name"); avatar = j.s("avatar"); amount = j.n("amount") }
}

struct GiftSummary: Hashable {
    let name, img: String
    let num: Int?
    init(_ j: J) { name = j.s("name"); img = j.s("img"); num = j.n("num") }
}

struct RecentDetail {
    let live: RecentLive
    let gifts: [GiftSummary]
    let fans: [Fan]
    let comments: Int?
    /// Kosong selama masa kunci (server tidak mengirim URL apa pun; IDN terkunci 72 jam).
    let recordings: [Recording]
    let recordingCount: Int
    let replayUnlockAt: String
    let screenshots: [String]

    init(_ j: J) {
        live = RecentLive(j); gifts = j.objs("gifts").map(GiftSummary.init); fans = j.objs("fans").map(Fan.init)
        comments = j.n("comments"); recordings = j.objs("recordings").map(Recording.init)
        recordingCount = j.n("recordingCount") ?? 0; replayUnlockAt = j.s("replayUnlockAt")
        screenshots = j.objs("screenshots").map { $0.s("url") }.filter { !$0.isEmpty }
    }
}

struct NewsItem: Identifiable, Hashable {
    let id, title, date, category, url, content: String
    init(_ j: J) { id = j.s("id"); title = j.s("title"); date = j.s("date"); category = j.s("category"); url = j.s("url"); content = j.s("content") }
}

struct Birthday: Identifiable, Hashable {
    let id, name, img, birthdate: String
    init(_ j: J) { id = j.s("id"); name = j.s("name"); img = j.s("img"); birthdate = j.s("birthdate") }

    /// Ulang tahun berikutnya dalam tanggal WIB (birthdate API = 17:00Z hari sebelumnya) dan umurnya saat itu.
    var next: (date: Date, age: Int)? {
        guard let born = Fmt.parse(birthdate) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = Fmt.zone
        let b = cal.dateComponents([.year, .month, .day], from: born)
        let today = cal.startOfDay(for: Date())
        let year = cal.component(.year, from: today)
        guard var next = cal.date(from: DateComponents(year: year, month: b.month, day: b.day)) else { return nil }
        if next < today, let n = cal.date(from: DateComponents(year: year + 1, month: b.month, day: b.day)) { next = n }
        return (next, cal.component(.year, from: next) - (b.year ?? 0))
    }
}

struct Video: Identifiable, Hashable {
    let id, title, url, date, thumbnail, channel: String
    let views: Int?
    let playable: Bool
    init(_ j: J) {
        id = j.s("id"); title = j.s("title"); url = j.s("url"); date = j.s("date"); thumbnail = j.s("thumbnail")
        channel = j.s("channel"); views = j.n("views"); playable = j.b("playable")
    }
}

struct VideoDetail {
    let video: Video
    let description: String
    let duration: Int?
    let comments: Int?
    /// Playlist HLS bertiket (± 3 jam); nil bila belum siap.
    let playbackUrl: String?
    let qualities: [Int]
    /// Detik epoch kedaluwarsa tiket; detail dari cache disk bisa membawa tiket basi.
    let expiresAt: Double?

    init(_ j: J) {
        video = Video(j); description = j.s("description"); duration = j.n("duration"); comments = j.n("comments")
        let pb = j.obj("playback")
        let u = pb?.s("url") ?? ""
        playbackUrl = u.hasPrefix("http") ? u : nil
        qualities = (pb?["qualities"] as? [Any])?.compactMap { ($0 as? NSNumber)?.intValue } ?? []
        expiresAt = pb?.d("expiresAt")
    }

    /// URL putar yang masih berlaku ≥ 1 menit lagi.
    var freshPlayback: URL? {
        guard let u = playbackUrl else { return nil }
        if let e = expiresAt, e < Date().timeIntervalSince1970 + 60 { return nil }
        return URL(string: u)
    }
}

struct VideoComment: Identifiable, Hashable {
    let id, text, author, avatar, when: String
    let uploader: Bool
    let likes: Int?
    let replies: Int?
    init(_ j: J) {
        id = j.s("id"); text = j.s("text"); author = j.s("author"); avatar = j.s("avatar"); when = j.s("when")
        uploader = j.b("uploader"); likes = j.n("likes"); replies = j.n("replies")
    }
}

struct VideoComments {
    let items: [VideoComment]
    let cursor: String
    let hasMore: Bool
    init(_ j: J) { items = j.objs("items").map(VideoComment.init); cursor = j.s("cursor"); hasMore = j.b("hasMore") }
}

struct SocialMedia: Hashable {
    let type, url, thumb: String
    let width: Int?
    let height: Int?
    init(_ j: J) { type = j.s("type"); url = j.s("url"); thumb = j.s("thumb"); width = j.n("width"); height = j.n("height") }
    var isVideo: Bool { type == "video" }
    var ratio: CGFloat? {
        guard let w = width, let h = height, w > 0, h > 0 else { return nil }
        return CGFloat(w) / CGFloat(h)
    }
}

struct SocialPost: Identifiable, Hashable {
    let platform, id, url, text, date: String
    let memberId, memberName, memberImg, username, authorName, avatar: String
    let likes: Int?
    let comments: Int?
    let views: Int?
    let media: [SocialMedia]

    init(_ j: J) {
        platform = j.s("platform"); id = j.s("id"); url = j.s("url"); text = j.s("text"); date = j.s("date")
        let m = j.obj("member") ?? [:]
        let a = j.obj("author") ?? [:]
        memberId = m.s("id"); memberName = m.s("name"); memberImg = m.s("img"); username = a.s("username"); authorName = a.s("name"); avatar = a.s("avatar")
        likes = j.n("likes"); comments = j.n("comments"); views = j.n("views"); media = j.objs("media").map(SocialMedia.init)
    }

    var platformLabel: String { ["x": "X", "tiktok": "TikTok", "instagram": "Instagram"][platform] ?? platform }
}

struct SocialPage {
    let items: [SocialPost]
    let cursor: String
    let hasMore: Bool
    init(_ j: J) { items = j.objs("items").map(SocialPost.init); cursor = j.s("cursor"); hasMore = j.b("hasMore") }
}
