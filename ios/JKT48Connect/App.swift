import AVFoundation
import SwiftUI

@main
struct JKT48ConnectApp: App {
    @StateObject private var favorites = Favorites()

    init() {
        // Audio tetap jalan saat layar terkunci / PiP; tidak dibisukan tombol senyap.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
    }

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(favorites).tint(Theme.brand)
        }
    }
}

/// Halaman di atas tab utama.
enum Route: Hashable {
    case watch(LiveSession)
    case theater(id: String, title: String)
    case recent(RecentLive)
    case member(id: String, name: String, img: String)
    case video(Video)
    case news(NewsItem)
    case player(url: String, title: String)
    case social(platform: String = "x", member: String = "", name: String = "")
    case videos, newsList, birthdays, about
}

enum AppTab: Int, Hashable, CaseIterable {
    case home, live, schedule, recent, members

    var title: String { ["Beranda", "Live", "Jadwal", "Recent", "Member"][rawValue] }
    var icon: String { ["house.fill", "dot.radiowaves.left.and.right", "calendar", "clock.arrow.circlepath", "person.2.fill"][rawValue] }
}

/// Tab bar native: di iOS 26 otomatis menjadi Liquid Glass yang mengambang & mengecil saat menggulir.
struct RootView: View {
    @State private var tab: AppTab = {
        // Untuk tangkapan layar CI: JKC_TAB=live dll.
        let env = ProcessInfo.processInfo.environment["JKC_TAB"] ?? ""
        return AppTab.allCases.first { "\($0)" == env } ?? .home
    }()
    @State private var paths: [AppTab: NavigationPath] = [:]

    var body: some View {
        TabView(selection: $tab) {
            ForEach(AppTab.allCases, id: \.self) { t in
                NavigationStack(path: binding(t)) {
                    screen(t)
                        .navigationDestination(for: Route.self) { RouteView(route: $0) }
                }
                .tabItem { Label(t.title, systemImage: t.icon) }
                .tag(t)
            }
        }
        .environment(\.nav, Nav(tab: { tab = $0 }, push: { paths[tab, default: NavigationPath()].append($0) }))
        .modifier(MinimizeTabBar())
        .onAppear(perform: openStartRoute)
    }

    private func binding(_ t: AppTab) -> Binding<NavigationPath> {
        Binding(get: { paths[t] ?? NavigationPath() }, set: { paths[t] = $0 })
    }

    @ViewBuilder
    private func screen(_ t: AppTab) -> some View {
        switch t {
        case .home: HomeView()
        case .live: LiveView()
        case .schedule: ScheduleView()
        case .recent: RecentView()
        case .members: MembersView()
        }
    }

    /// Untuk tangkapan layar CI: JKC_ROUTE=videos|social|news|birthdays|about membuka halaman itu di atas Beranda.
    private func openStartRoute() {
        let env = ProcessInfo.processInfo.environment["JKC_ROUTE"] ?? ""
        let route: Route? = ["videos": .videos, "social": .social(), "news": .newsList, "birthdays": .birthdays, "about": .about][env]
        if let route {
            var p = NavigationPath()
            p.append(route)
            paths[tab] = p
        }
    }
}

private struct MinimizeTabBar: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// Pindah tab / buka halaman dari mana saja.
struct Nav {
    var tab: (AppTab) -> Void = { _ in }
    var push: (Route) -> Void = { _ in }
}

private struct NavKey: EnvironmentKey { static let defaultValue = Nav() }

extension EnvironmentValues {
    var nav: Nav {
        get { self[NavKey.self] }
        set { self[NavKey.self] = newValue }
    }
}

struct RouteView: View {
    let route: Route
    var body: some View {
        switch route {
        case .watch(let l): WatchView(live: l)
        case .theater(let id, let title): TheaterDetailView(id: id, title: title)
        case .recent(let r): RecentDetailView(item: r)
        case .member(let id, let name, let img): MemberDetailView(id: id, name: name, img: img)
        case .video(let v): VideoDetailView(video: v)
        case .news(let n): NewsDetailView(item: n)
        case .player(let url, let title): MediaPlayerScreen(url: url, title: title)
        case .videos: VideosView()
        case .social(let p, let m, let n): SocialView(platform: p, member: m, memberName: n)
        case .newsList: NewsView()
        case .birthdays: BirthdaysView()
        case .about: AboutView()
        }
    }
}

/// Member favorit (oshi) disimpan di perangkat.
@MainActor
final class Favorites: ObservableObject {
    struct Fav: Codable, Hashable, Identifiable {
        let id, name, img: String
    }

    @Published private(set) var items: [String: Fav] = [:]
    var all: [Fav] { items.values.sorted { $0.name < $1.name } }

    init() {
        if let data = UserDefaults.standard.data(forKey: "favorites"), let list = try? JSONDecoder().decode([Fav].self, from: data) {
            items = Dictionary(list.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        }
    }

    func contains(_ id: String) -> Bool { items[id] != nil }

    func toggle(id: String, name: String, img: String) {
        if items[id] != nil { items[id] = nil } else { items[id] = Fav(id: id, name: name, img: img) }
        if let data = try? JSONEncoder().encode(Array(items.values)) { UserDefaults.standard.set(data, forKey: "favorites") }
    }
}

/// Tombol menu di bilah navigasi (kanan atas): halaman lain yang tidak ada di tab.
struct MoreMenu: View {
    @Environment(\.nav) private var nav
    var body: some View {
        Menu {
            Button { nav.push(.videos) } label: { Label("Video YouTube", systemImage: "play.rectangle.fill") }
            Button { nav.push(.social()) } label: { Label("Sosmed member", systemImage: "bubble.left.and.bubble.right.fill") }
            Button { nav.push(.newsList) } label: { Label("Berita", systemImage: "newspaper.fill") }
            Button { nav.push(.birthdays) } label: { Label("Ulang tahun", systemImage: "gift.fill") }
            Divider()
            Button { nav.push(.about) } label: { Label("Tentang aplikasi", systemImage: "info.circle") }
        } label: {
            Image(systemName: "ellipsis")
        }
    }
}

/// Struktur halaman standar: latar ambient, gulir, tarik untuk segarkan, judul besar, menu.
struct Page<Content: View>: View {
    let title: String
    var large = true
    var refresh: (() async -> Void)?
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) { content }
                .padding(.bottom, 24)
        }
        .background(Ambient())
        .refreshable { await refresh?() }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(large ? .large : .inline)
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) { MoreMenu() } }
    }
}
