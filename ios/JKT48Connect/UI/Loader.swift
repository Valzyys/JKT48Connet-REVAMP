import SwiftUI

/// Memuat satu sumber data: tampil dulu dari cache tersimpan, lalu diperbarui dari jaringan. Tarik untuk segarkan = paksa.
@MainActor
final class Load<T>: ObservableObject {
    @Published var data: T?
    @Published var error: String?
    @Published var loading = false
    private let block: (Fetch) async throws -> T
    private var started = false

    init(_ block: @escaping (Fetch) async throws -> T) { self.block = block }

    func start() async {
        guard !started else { return }
        started = true
        if data == nil, let cached = try? await block(.cache) { data = cached }
        await run(.normal)
    }

    func refresh() async { await run(.force) }

    private func run(_ f: Fetch) async {
        loading = true
        defer { loading = false }
        do {
            data = try await block(f)
            error = nil
        } catch {
            if data == nil { self.error = error.localizedDescription }
        }
    }
}

/// Daftar berhalaman (recent, theater, berita): halaman berikutnya dimuat saat baris terakhir muncul.
@MainActor
final class PagedLoad<T: Identifiable>: ObservableObject {
    @Published var items: [T] = []
    @Published var error: String?
    @Published var loading = false
    @Published var hasMore = true
    private var page = 0
    private let block: (Int, Fetch) async throws -> Paged<T>

    init(_ block: @escaping (Int, Fetch) async throws -> Paged<T>) { self.block = block }

    func start() async {
        guard page == 0 else { return }
        if let cached = try? await block(1, .cache) { items = cached.items }
        await load(reset: true, fetch: .normal)
    }

    func refresh() async { await load(reset: true, fetch: .force) }

    func more(after item: T) async {
        guard hasMore, !loading, item.id == items.last?.id else { return }
        await load(reset: false, fetch: .normal)
    }

    private func load(reset: Bool, fetch: Fetch) async {
        loading = true
        defer { loading = false }
        let next = reset ? 1 : page + 1
        do {
            let p = try await block(next, fetch)
            if reset {
                items = p.items
            } else {
                let seen = Set(items.map { "\($0.id)" })
                items += p.items.filter { !seen.contains("\($0.id)") }
            }
            page = next
            hasMore = p.hasMore
            error = nil
        } catch {
            if items.isEmpty { self.error = error.localizedDescription }
            hasMore = false
        }
    }
}

/// Isi layar sesuai status muat: memuat, galat (dengan tombol coba lagi), atau konten.
struct LoadView<T, Content: View>: View {
    @ObservedObject var load: Load<T>
    @ViewBuilder var content: (T) -> Content

    var body: some View {
        if let data = load.data {
            content(data)
        } else if let error = load.error {
            ErrorState(message: error) { Task { await load.refresh() } }
        } else {
            ProgressView().tint(Theme.brand).frame(maxWidth: .infinity, minHeight: 200)
        }
    }
}

struct ErrorState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.system(size: 30)).foregroundStyle(Theme.inkSoft)
            Text(message).font(.subheadline).foregroundStyle(Theme.inkSoft).multilineTextAlignment(.center)
            GlassButton(action: retry) { Text("Coba lagi").font(.subheadline.weight(.bold)) }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
    }
}

struct EmptyState: View {
    let icon: String
    let text: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 28)).foregroundStyle(Theme.inkSoft)
            Text(text).font(.subheadline).foregroundStyle(Theme.inkSoft).multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .glassCard()
    }
}
