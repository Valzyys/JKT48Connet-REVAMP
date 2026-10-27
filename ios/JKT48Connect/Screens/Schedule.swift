import SwiftUI

/// Jadwal: "Mendatang" (dikelompokkan per hari) dan arsip "Theater" berhalaman.
struct ScheduleView: View {
    @State private var seg = 0
    @StateObject private var next = Load { try await Api.shared.nextSchedule($0) }
    @StateObject private var theater = PagedLoad { try await Api.shared.theater(page: $0, $1) }

    var body: some View {
        Page(title: "Jadwal", refresh: { if seg == 0 { await next.refresh() } else { await theater.refresh() } }) {
            GlassSegmented(options: ["Mendatang", "Theater"], selection: $seg).padding(.top, 4).padding(.bottom, 12)
            if seg == 0 {
                LoadView(load: next) { shows in
                    if shows.isEmpty {
                        EmptyState(icon: "calendar", text: "Belum ada jadwal mendatang.").padding(.horizontal, 16)
                    } else {
                        ForEach(groups(shows), id: \.0) { g in
                            Micro(g.0).padding(.horizontal, 22).padding(.top, 10).padding(.bottom, 8)
                            ForEach(g.1) { show in
                                NavigationLink(value: Route.theater(id: show.id, title: show.title)) { ShowTile(show: show) }
                                    .buttonStyle(Pressable())
                                    .padding(.horizontal, 16).padding(.bottom, 10)
                            }
                        }
                    }
                }
            } else {
                PagedList(load: theater) { show in
                    NavigationLink(value: Route.theater(id: show.id, title: show.title)) { ShowTile(show: show) }.buttonStyle(Pressable())
                }
            }
        }
        .task { await next.start() }
        .onChange(of: seg) { s in if s == 1 { Task { await theater.start() } } }
    }

    private func groups(_ shows: [TheaterShow]) -> [(String, [TheaterShow])] {
        var order: [String] = []
        var map: [String: [TheaterShow]] = [:]
        for s in shows {
            let k = Fmt.wib(s.date, "EEEE, d MMMM")
            if map[k] == nil { order.append(k) }
            map[k, default: []].append(s)
        }
        return order.map { ($0, map[$0] ?? []) }
    }
}

/// Isi daftar berhalaman: baris, indikator muat, galat.
struct PagedList<T: Identifiable, Row: View>: View {
    @ObservedObject var load: PagedLoad<T>
    @ViewBuilder var row: (T) -> Row

    var body: some View {
        if load.items.isEmpty && load.loading {
            ForEach(0..<5, id: \.self) { _ in Skeleton(height: 94).padding(.horizontal, 16).padding(.bottom, 10) }
        }
        ForEach(load.items) { item in
            row(item)
                .padding(.horizontal, 16).padding(.bottom, 10)
                .onAppear { Task { await load.more(after: item) } }
        }
        if let e = load.error { ErrorState(message: e) { Task { await load.refresh() } } }
        if load.loading && !load.items.isEmpty { ProgressView().frame(maxWidth: .infinity).padding() }
    }
}

/// Detail show: poster, tanggal & hitung mundur, lineup member, setlist lagu.
struct TheaterDetailView: View {
    let id: String
    let title: String
    @StateObject private var detail: Load<TheaterDetail>
    @Environment(\.openURL) private var openURL

    init(id: String, title: String) {
        self.id = id
        self.title = title
        _detail = StateObject(wrappedValue: Load { try await Api.shared.theaterDetail(id, $0) })
    }

    var body: some View {
        ScrollView {
            LoadView(load: detail) { d in
                let show = d.show
                VStack(alignment: .leading, spacing: 16) {
                    if !show.image.isEmpty {
                        RemoteImage(show.image, maxPixel: 1400).frame(maxWidth: .infinity).frame(height: 210)
                            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            CategoryPill(text: show.category)
                            if !show.team.isEmpty { Micro(show.team) }
                        }
                        Text(show.title.uppercased()).font(.display(32)).foregroundStyle(Theme.ink)
                        Text("\(Fmt.wib(show.date, "EEEE, d MMMM yyyy")) · \(Fmt.time(show.date)) WIB").font(.mono(12)).foregroundStyle(Theme.inkSoft)
                    }
                    if let date = Fmt.parse(show.date), date > Date() {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Micro("Mulai dalam", color: .white.opacity(0.75))
                                Countdown(date: date, font: .display(30))
                            }
                            Spacer()
                            Image(systemName: "timer").font(.system(size: 30, weight: .bold)).foregroundStyle(.white.opacity(0.5))
                        }
                        .padding(18)
                        .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                    }
                    if !show.birthday.isEmpty { memberGrid("Ulang tahun di show ini", show.birthday) }
                    if !d.graduation.isEmpty { memberGrid("Graduation", d.graduation) }
                    if !show.members.isEmpty { memberGrid("Lineup · \(show.members.count) member", show.members) }
                    if !d.songs.isEmpty {
                        Micro("Setlist · \(d.songs.count) lagu", color: Theme.brand).padding(.top, 6)
                        VStack(spacing: 0) {
                            ForEach(Array(d.songs.enumerated()), id: \.offset) { i, song in
                                if i > 0 { GroupDivider(inset: 44) }
                                HStack(spacing: 12) {
                                    Text(String(format: "%02d", i + 1)).font(.mono(12, .semibold)).foregroundStyle(Theme.brand).frame(width: 22)
                                    Text(song).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink)
                                    Spacer()
                                }
                                .padding(.horizontal, 14).padding(.vertical, 10)
                            }
                        }
                        .glassCard(24)
                    }
                    if let u = URL(string: show.url), !show.url.isEmpty {
                        GlassButton(prominent: true, action: { openURL(u) }) {
                            Label("Buka di jkt48.com", systemImage: "arrow.up.right").font(.subheadline.weight(.bold)).frame(maxWidth: .infinity)
                        }
                        .padding(.top, 6)
                    }
                }
                .padding(16)
            }
        }
        .background(Ambient())
        .refreshable { await detail.refresh() }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await detail.start() }
    }

    private func memberGrid(_ label: String, _ members: [ShowMember]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Micro(label, color: Theme.brand).padding(.top, 6)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 10)], spacing: 12) {
                ForEach(members) { m in
                    NavigationLink(value: Route.member(id: m.id, name: m.name, img: m.img)) {
                        VStack(spacing: 6) {
                            RemoteImage(m.img, fallback: m.name, maxPixel: 240).frame(width: 64, height: 64).clipShape(Circle())
                            Text(m.name.split(separator: " ").first.map(String.init) ?? m.name).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                        }
                    }
                    .buttonStyle(Pressable())
                }
            }
            .padding(12)
            .glassCard(24)
        }
    }
}
