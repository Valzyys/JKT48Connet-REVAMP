import Foundation

/// Objek JSON longgar: field yang hilang/null jadi nilai kosong, sama seperti klien Android (`j.s("key")`).
/// Bentuk data mengikuti respons `/api/app/*` (dinormalisasi worker, lihat src/lib/shape.ts).
typealias J = [String: Any]

extension Dictionary where Key == String, Value == Any {
    func s(_ key: String) -> String {
        if let v = self[key] as? String { return v }
        if let v = self[key] as? NSNumber { return v.stringValue }
        return ""
    }

    func n(_ key: String) -> Int? {
        guard let v = self[key], !(v is NSNull) else { return nil }
        if let v = v as? NSNumber { return v.intValue }
        if let v = v as? String { return Int(v) }
        return nil
    }

    func d(_ key: String) -> Double? {
        guard let v = self[key], !(v is NSNull) else { return nil }
        if let v = v as? NSNumber { return v.doubleValue }
        if let v = v as? String { return Double(v) }
        return nil
    }

    func b(_ key: String) -> Bool { (self[key] as? NSNumber)?.boolValue ?? false }

    func obj(_ key: String) -> J? { self[key] as? J }

    func objs(_ key: String) -> [J] { (self[key] as? [Any])?.compactMap { $0 as? J } ?? [] }

    func strings(_ key: String) -> [String] { (self[key] as? [Any])?.compactMap { $0 as? String } ?? [] }
}

/// Halaman berisi `items`, `page`, `perpage`, `total` (recent, theater, news).
struct Paged<T> {
    let items: [T]
    let page: Int
    let perpage: Int
    let total: Int
    var hasMore: Bool { !items.isEmpty && page * perpage < total }

    init(_ j: J, _ map: (J) -> T) {
        items = j.objs("items").map(map)
        page = j.n("page") ?? 1
        perpage = max(1, j.n("perpage") ?? 12)
        total = j.n("total") ?? 0
    }
}
