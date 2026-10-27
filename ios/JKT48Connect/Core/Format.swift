import Foundation

/// Format tanggal/waktu WIB dan angka dalam bahasa Indonesia.
enum Fmt {
    static let zone = TimeZone(identifier: "Asia/Jakarta") ?? .current
    static let locale = Locale(identifier: "id_ID")

    private static let isoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ s: String) -> Date? {
        if s.isEmpty { return nil }
        return isoFrac.date(from: s) ?? iso.date(from: s)
    }

    private static var cache: [String: DateFormatter] = [:]
    private static let lock = NSLock()

    /// `pattern` gaya DateFormatter, mis. "EEEE, d MMMM" atau "HH.mm"; selalu di zona WIB.
    static func wib(_ date: Date, _ pattern: String) -> String {
        lock.lock()
        defer { lock.unlock() }
        let f = cache[pattern] ?? {
            let f = DateFormatter()
            f.locale = locale
            f.timeZone = zone
            f.dateFormat = pattern
            cache[pattern] = f
            return f
        }()
        return f.string(from: date)
    }

    static func wib(_ iso: String, _ pattern: String) -> String { parse(iso).map { wib($0, pattern) } ?? "" }

    static func time(_ date: Date) -> String { wib(date, "HH.mm") }
    static func time(_ iso: String) -> String { wib(iso, "HH.mm") }

    /// "5 menit lalu", "2 jam lalu", "kemarin".
    static func ago(_ iso: String) -> String {
        guard let d = parse(iso) else { return "" }
        let s = Int(Date().timeIntervalSince(d))
        switch s {
        case ..<60: return "baru saja"
        case ..<3600: return "\(s / 60) menit lalu"
        case ..<86400: return "\(s / 3600) jam lalu"
        case ..<172_800: return "kemarin"
        default: return "\(s / 86400) hari lalu"
        }
    }

    /// 7_240_000 ms → "2j 0m"; < 1 jam → "45m".
    static func duration(_ ms: Int) -> String {
        let m = ms / 60000
        return m >= 60 ? "\(m / 60)j \(m % 60)m" : "\(m)m"
    }

    /// 1:02:03 / 02:03
    static func clock(_ seconds: Int) -> String {
        let s = max(0, seconds)
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%02d:%02d", s / 60, s % 60)
    }

    /// 12_345 → "12,3 rb"; 1_234_567 → "1,2 jt".
    static func compact(_ n: Int?) -> String {
        guard let n else { return "–" }
        func one(_ v: Double) -> String { String(format: "%.1f", v).replacingOccurrences(of: ".0", with: "").replacingOccurrences(of: ".", with: ",") }
        switch n {
        case 1_000_000...: return "\(one(Double(n) / 1_000_000)) jt"
        case 10_000...: return "\(one(Double(n) / 1000)) rb"
        default:
            let f = NumberFormatter()
            f.locale = locale
            f.numberStyle = .decimal
            return f.string(from: NSNumber(value: n)) ?? "\(n)"
        }
    }

    /// Hitung mundur: "1 hari 02:03:04" / "02:03:04".
    static func countdown(to date: Date, now: Date = Date()) -> String {
        let s = Int(date.timeIntervalSince(now))
        if s <= 0 { return "Sedang berlangsung" }
        let days = s / 86400
        let rest = String(format: "%02d:%02d:%02d", s % 86400 / 3600, s % 3600 / 60, s % 60)
        return days > 0 ? "\(days) hari \(rest)" : rest
    }

    /// Teks polos dari isi berita HTML.
    static func plain(_ html: String) -> String {
        var s = html.replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: [.regularExpression, .caseInsensitive])
        s = s.replacingOccurrences(of: "</p>", with: "\n\n", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        let entities = ["&nbsp;": " ", "&amp;": "&", "&quot;": "\"", "&#39;": "'", "&lt;": "<", "&gt;": ">"]
        for (k, v) in entities { s = s.replacingOccurrences(of: k, with: v) }
        return s.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
