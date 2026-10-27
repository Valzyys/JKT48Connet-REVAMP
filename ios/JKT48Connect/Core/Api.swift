import CryptoKit
import Foundation

struct ApiError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

/// Cara mengambil data: cache saja (tampil instan), normal (cache memori bila masih segar), atau paksa jaringan.
enum Fetch { case cache, normal, force }

/**
 Klien jalur aplikasi `/api/app` — sama dengan klien Android:
 token aplikasi (Bearer) diminta otomatis lewat `POST /api/app/session`, disimpan, dan diperbarui saat ditolak (401).
 Respons disimpan di memori dan di disk, jadi halaman tampil seketika dari cache terakhir lalu diperbarui,
 dan tetap bisa dibuka saat koneksi putus.
 */
actor Api {
    static let shared = Api()
    nonisolated static let base = URL(string: "https://jkt48connect.app")!

    private var token: String?
    private var tokenTask: Task<String, Error>?
    private var memory: [String: (at: Date, value: Any)] = [:]
    private let session: URLSession
    private let diskDir: URL

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config)
        diskDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("api", isDirectory: true)
        try? FileManager.default.createDirectory(at: diskDir, withIntermediateDirectories: true)
    }

    nonisolated static func absolute(_ path: String) -> URL {
        if path.hasPrefix("http"), let u = URL(string: path) { return u }
        return URL(string: path, relativeTo: base)?.absoluteURL ?? base
    }

    /// Header untuk pemutar replay (URL worker sendiri) — token yang sama dengan data.
    func authHeaders() async throws -> [String: String] { ["Authorization": "Bearer \(try await ensureToken())"] }

    private func ensureToken() async throws -> String {
        if let token { return token }
        let defaults = UserDefaults.standard
        if let saved = defaults.string(forKey: "app_token"), defaults.double(forKey: "app_token_exp") > Date().timeIntervalSince1970 + 3600 {
            token = saved
            return saved
        }
        if let tokenTask { return try await tokenTask.value }
        let task = Task<String, Error> {
            var req = URLRequest(url: Api.base.appendingPathComponent("api/app/session"))
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            req.httpBody = Data("{}".utf8)
            let (data, res) = try await session.data(for: req)
            let status = (res as? HTTPURLResponse)?.statusCode ?? 0
            let obj = try Api.decode(status: status, data: data) as? J
            guard let t = obj?["token"] as? String else { throw ApiError(status: status, message: "Token tidak valid") }
            defaults.set(t, forKey: "app_token")
            defaults.set(obj?.d("exp") ?? 0, forKey: "app_token_exp")
            return t
        }
        tokenTask = task
        defer { tokenTask = nil }
        let t = try await task.value
        token = t
        return t
    }

    private func dropToken() {
        token = nil
        UserDefaults.standard.removeObject(forKey: "app_token")
    }

    /// Ambil JSON `/api/app<path>`. `ttl`: umur cache memori yang masih dianggap segar.
    func get(_ path: String, ttl: TimeInterval = 60, fetch: Fetch = .normal) async throws -> Any {
        if fetch == .cache {
            if let hit = memory[path] { return hit.value }
            if let disk = fromDisk(path) { return disk }
            throw ApiError(status: 0, message: "Belum ada data tersimpan")
        }
        if fetch == .normal, let hit = memory[path], Date().timeIntervalSince(hit.at) < ttl { return hit.value }
        do {
            let value = try await request(path, retry: true)
            memory[path] = (Date(), value)
            toDisk(path, value)
            return value
        } catch let e as ApiError where e.status == 0 {
            // Offline: pakai salinan terakhir bila ada.
            if let hit = memory[path] { return hit.value }
            if let disk = fromDisk(path) { return disk }
            throw e
        }
    }

    /// Salinan tersimpan (tanpa jaringan) untuk tampilan awal yang instan.
    func cached(_ path: String) -> Any? { memory[path]?.value ?? fromDisk(path) }

    private func request(_ path: String, retry: Bool) async throws -> Any {
        let t = try await ensureToken()
        var req = URLRequest(url: Api.absolute("/api/app" + path))
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        let data: Data
        let res: URLResponse
        do {
            (data, res) = try await session.data(for: req)
        } catch {
            throw ApiError(status: 0, message: "Tidak bisa terhubung. Periksa koneksi internet.")
        }
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 && retry {
            dropToken()
            return try await request(path, retry: false)
        }
        return try Api.decode(status: status, data: data)
    }

    private static func decode(status: Int, data: Data) throws -> Any {
        let body = try? JSONSerialization.jsonObject(with: data)
        if status >= 400 || status == 0 {
            let obj = body as? J
            // Diblokir penjaga anti-iseng situs: jelaskan sampai kapan, bukan sekadar "Akses diblokir".
            if obj?.s("code") == "blocked" {
                var msg = "Akses dari jaringanmu diblokir sementara oleh situs"
                if let until = obj?.d("until"), until > 0 { msg += " sampai \(Fmt.time(Date(timeIntervalSince1970: until / 1000))) WIB" }
                let incident = obj?.s("incident") ?? ""
                throw ApiError(status: status, message: msg + ". Coba lagi nanti" + (incident.isEmpty ? "." : " · ID \(incident)."))
            }
            let m = obj?.s("message") ?? ""
            throw ApiError(status: status, message: m.isEmpty ? "Gagal memuat data (\(status))" : m)
        }
        guard let body else { throw ApiError(status: status, message: "Respons tidak valid") }
        return body
    }

    private func diskURL(_ path: String) -> URL {
        let hash = Insecure.SHA1.hash(data: Data(path.utf8)).map { String(format: "%02x", $0) }.joined()
        return diskDir.appendingPathComponent(hash)
    }

    private func fromDisk(_ path: String) -> Any? {
        guard let data = try? Data(contentsOf: diskURL(path)) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    private func toDisk(_ path: String, _ value: Any) {
        guard JSONSerialization.isValidJSONObject(value), let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        try? data.write(to: diskURL(path), options: .atomic)
    }
}

// MARK: - Endpoint

extension Api {
    static func enc(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/?&=#"))) ?? s }

    func live(_ f: Fetch = .normal) async throws -> [LiveSession] { try list(await get("/now_live", ttl: 20, fetch: f)).map(LiveSession.init) }
    func members(_ f: Fetch = .normal) async throws -> [Member] { try list(await get("/member", ttl: 1800, fetch: f)).map(Member.init) }
    func member(_ id: String, _ f: Fetch = .normal) async throws -> MemberDetail { MemberDetail(try obj(await get("/member/\(Api.enc(id))", ttl: 600, fetch: f))) }
    func nextSchedule(_ f: Fetch = .normal) async throws -> [TheaterShow] { try list(await get("/next_schedule", ttl: 300, fetch: f)).map(TheaterShow.init) }
    func theater(page: Int, _ f: Fetch = .normal) async throws -> Paged<TheaterShow> { Paged(try obj(await get("/theater?page=\(page)&perpage=12", ttl: 300, fetch: f)), TheaterShow.init) }
    func theaterDetail(_ id: String, _ f: Fetch = .normal) async throws -> TheaterDetail { TheaterDetail(try obj(await get("/theater/\(Api.enc(id))", ttl: 600, fetch: f))) }
    func recent(page: Int, _ f: Fetch = .normal) async throws -> Paged<RecentLive> { Paged(try obj(await get("/recent?page=\(page)&perpage=12", ttl: 180, fetch: f)), RecentLive.init) }
    func recentDetail(_ id: String, _ f: Fetch = .normal) async throws -> RecentDetail { RecentDetail(try obj(await get("/recent/\(Api.enc(id))", ttl: 180, fetch: f))) }
    func news(page: Int, _ f: Fetch = .normal) async throws -> Paged<NewsItem> { Paged(try obj(await get("/news?page=\(page)&perpage=10", ttl: 600, fetch: f)), NewsItem.init) }
    func newsDetail(_ id: String, _ f: Fetch = .normal) async throws -> NewsItem { NewsItem(try obj(await get("/news/\(Api.enc(id))", ttl: 3600, fetch: f))) }
    func birthdays(_ f: Fetch = .normal) async throws -> [Birthday] { try list(await get("/next_birthday", ttl: 3600, fetch: f)).map(Birthday.init) }
    func videos(_ f: Fetch = .normal) async throws -> [Video] { try list(await get("/jkt48_youtube", ttl: 180, fetch: f)).map(Video.init) }
    func video(_ id: String, _ f: Fetch = .normal) async throws -> VideoDetail { VideoDetail(try obj(await get("/jkt48_youtube/\(Api.enc(id))", ttl: 900, fetch: f))) }
    func videoComments(_ id: String, cursor: String = "") async throws -> VideoComments {
        let q = cursor.isEmpty ? "" : "?cursor=\(cursor.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? cursor)"
        return VideoComments(try obj(await get("/jkt48_youtube/\(Api.enc(id))/comments\(q)", ttl: 120)))
    }
    /// `platform`: x, tiktok, instagram. `before`: cursor halaman berikutnya.
    func social(_ platform: String, member: String = "", before: String = "", _ f: Fetch = .normal) async throws -> SocialPage {
        let path = ["x": "/x/tweets", "tiktok": "/tiktok/posts", "instagram": "/instagram/posts"][platform] ?? "/x/tweets"
        var q: [String] = ["limit=20"]
        if !member.isEmpty { q.append("member=\(Api.enc(member))") }
        if !before.isEmpty { q.append("before=\(before.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? before)") }
        return SocialPage(try obj(await get(path + "?" + q.joined(separator: "&"), ttl: 60, fetch: f)))
    }

    private func list(_ v: Any) throws -> [J] {
        guard let a = v as? [Any] else { throw ApiError(status: 200, message: "Respons tidak valid") }
        return a.compactMap { $0 as? J }
    }

    private func obj(_ v: Any) throws -> J {
        guard let o = v as? J else { throw ApiError(status: 200, message: "Respons tidak valid") }
        return o
    }
}
