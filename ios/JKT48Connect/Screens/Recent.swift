import SwiftUI

struct RecentView: View {
    @StateObject private var recent = PagedLoad { try await Api.shared.recent(page: $0, $1) }

    var body: some View {
        Page(title: "Recent", refresh: { await recent.refresh() }) {
            Micro("Gift · supporter · replay").padding(.horizontal, 20).padding(.bottom, 10)
            PagedList(load: recent) { r in
                NavigationLink(value: Route.recent(r)) { RecentTile(r: r) }.buttonStyle(Pressable())
            }
        }
        .task { await recent.start() }
    }
}

/// Detail rekap: foto, statistik, replay (IDN terkunci 72 jam; Showroom langsung), supporter, gift, cuplikan.
struct RecentDetailView: View {
    let item: RecentLive
    @StateObject private var detail: Load<RecentDetail>

    init(item: RecentLive) {
        self.item = item
        let id = item.id
        _detail = StateObject(wrappedValue: Load { try await Api.shared.recentDetail(id, $0) })
    }

    var body: some View {
        let r = detail.data?.live ?? item
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 16) {
                    RemoteImage(r.img, fallback: r.name, maxPixel: 300).frame(width: 84, height: 100).clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    VStack(alignment: .leading, spacing: 6) {
                        Micro(platformLabel(r.platform), color: Theme.brand)
                        Text(r.name.uppercased()).font(.display(32)).foregroundStyle(Theme.ink).lineLimit(2)
                        Text("\(Fmt.wib(r.start, "EEEE, d MMM yyyy")) · \(Fmt.time(r.start))").font(.mono(11.5)).foregroundStyle(Theme.inkSoft)
                    }
                }
                GlassGroup(spacing: 10) {
                    VStack(spacing: 10) {
                        HStack(spacing: 10) {
                            StatBox(label: "Durasi", value: Fmt.duration(r.durationMs), accent: true)
                            StatBox(label: "Penonton", value: Fmt.compact(r.viewers))
                        }
                        HStack(spacing: 10) {
                            StatBox(label: r.pointLabel, value: Fmt.compact(r.points))
                            StatBox(label: "Komentar", value: Fmt.compact(detail.data?.comments))
                        }
                    }
                }

                LoadView(load: detail) { d in
                    VStack(alignment: .leading, spacing: 16) {
                        ReplayPanel(d: d) { Task { await detail.refresh() } }
                        if !d.fans.isEmpty { fans(d.fans) }
                        if !d.gifts.isEmpty { gifts(d.gifts) }
                        if !d.screenshots.isEmpty { shots(d.screenshots) }
                    }
                }
            }
            .padding(16)
        }
        .background(Ambient())
        .refreshable { await detail.refresh() }
        .navigationTitle(item.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await detail.start() }
    }

    private func fans(_ fans: [Fan]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Micro("Top supporter", color: Theme.brand).padding(.top, 10)
            VStack(spacing: 0) {
                ForEach(Array(fans.prefix(10).enumerated()), id: \.offset) { i, f in
                    if i > 0 { GroupDivider(inset: 0) }
                    HStack(spacing: 10) {
                        Text("\(i + 1)").font(.mono(11.5, .semibold)).foregroundStyle(i < 3 ? .white : Theme.inkSoft)
                            .frame(width: 26, height: 26)
                            .background(i < 3 ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Color.clear), in: Circle())
                        RemoteImage(f.avatar, fallback: f.name, maxPixel: 120).frame(width: 34, height: 34).clipShape(Circle())
                        Text(f.name).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                        Spacer()
                        Text(Fmt.compact(f.amount)).font(.mono(12.5, .semibold)).foregroundStyle(i < 3 ? Theme.brand : Theme.ink)
                    }
                    .padding(.vertical, 8)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .glassCard(24)
        }
    }

    private func gifts(_ gifts: [GiftSummary]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Micro("Gift", color: Theme.brand).padding(.top, 10)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(Array(gifts.prefix(18).enumerated()), id: \.offset) { _, g in
                    HStack(spacing: 6) {
                        if g.img.isEmpty {
                            Image(systemName: "gift.fill").foregroundStyle(Theme.brand).frame(width: 26, height: 26)
                        } else {
                            AsyncImage(url: URL(string: g.img)) { $0.resizable().scaledToFit() } placeholder: { Color.clear }.frame(width: 26, height: 26)
                        }
                        Text("\(g.name) ×\(Fmt.compact(g.num))").font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.leading, 6).padding(.trailing, 12).padding(.vertical, 6)
                    .glass()
                }
            }
        }
    }

    private func shots(_ shots: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Micro("Cuplikan · \(shots.count)", color: Theme.brand).padding(.top, 10)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                ForEach(Array(shots.prefix(9).enumerated()), id: \.offset) { i, url in
                    NavigationLink {
                        ShotsViewer(urls: shots, start: i)
                    } label: {
                        Color.clear.aspectRatio(0.75, contentMode: .fit)
                            .overlay { RemoteImage(url, maxPixel: 400) }
                            .overlay {
                                if i == 8 && shots.count > 9 {
                                    ZStack { Color.black.opacity(0.55); Text("+\(shots.count - 9)").font(.display(30)).foregroundStyle(.white) }
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                }
            }
        }
    }
}

/// Replay: Showroom langsung jadi pemutar; IDN terkunci dengan hitung mundur sampai 72 jam setelah live (server).
private struct ReplayPanel: View {
    let d: RecentDetail
    let onUnlock: () -> Void
    @State private var part = 0
    @State private var headers: [String: String]?

    var body: some View {
        if d.recordingCount == 0 {
            EmptyView()
        } else if d.recordings.isEmpty {
            locked
        } else {
            let rec = d.recordings[min(part, d.recordings.count - 1)]
            let src = rec.hls.isEmpty ? rec.url : rec.hls
            VStack(alignment: .leading, spacing: 10) {
                Micro(d.recordings.count > 1 ? "Replay · bagian \(part + 1) dari \(d.recordings.count)" : "Replay", color: Theme.brand)
                PlayerFrame {
                    if let headers {
                        VideoPlayerView(url: Api.absolute(src), headers: headers, autoplay: false)
                    } else {
                        ProgressView().tint(.white)
                    }
                }
                if d.recordings.count > 1 {
                    GlassSegmented(options: d.recordings.indices.map { "Bagian \($0 + 1)" }, selection: $part).padding(.horizontal, -16)
                }
            }
            .task { headers = (try? await Api.shared.authHeaders()) ?? [:] }
        }
    }

    private var locked: some View {
        let unlock = Fmt.parse(d.replayUnlockAt)
        let start = Fmt.parse(d.live.end.isEmpty ? d.live.start : d.live.end)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Image(systemName: "lock.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 46, height: 46).background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                Micro("Replay IDN · terbuka 72 jam setelah live", color: .white.opacity(0.6))
            }
            if let unlock {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(Fmt.countdown(to: unlock, now: ctx.date)).font(.display(34)).foregroundStyle(.white).monospacedDigit()
                        if let start, unlock > start {
                            let p = min(1, max(0, ctx.date.timeIntervalSince(start) / unlock.timeIntervalSince(start)))
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(.white.opacity(0.15))
                                    Capsule().fill(Theme.brandGradient).frame(width: g.size.width * p)
                                }
                            }
                            .frame(height: 6)
                        }
                        Text("Terbuka \(Fmt.wib(unlock, "EEEE, d MMM · HH.mm")) WIB").font(.mono(11)).foregroundStyle(.white.opacity(0.6))
                        if unlock <= ctx.date {
                            Button(action: onUnlock) {
                                Text("Muat replay").font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.brand)
                                    .padding(.horizontal, 16).padding(.vertical, 9).background(.white, in: Capsule())
                            }
                            .buttonStyle(Pressable())
                        }
                    }
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.1, green: 0.09, blue: 0.11), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

/// Penampil cuplikan layar: geser kiri/kanan.
struct ShotsViewer: View {
    let urls: [String]
    @State var start: Int
    var body: some View {
        TabView(selection: $start) {
            ForEach(Array(urls.enumerated()), id: \.offset) { i, u in
                RemoteImage(u, maxPixel: 1600, fit: true).tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .automatic))
        .background(Color.black.ignoresSafeArea())
        .navigationTitle("\(start + 1) / \(urls.count)")
        .navigationBarTitleDisplayMode(.inline)
    }
}
