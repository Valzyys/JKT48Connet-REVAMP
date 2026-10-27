import SwiftUI

/**
 Beranda: kartu status merah (siapa yang live + show berikutnya), pintasan kaca, lalu bagian yang hanya tampil
 bila ada isinya: oshi, live, video, recent, ulang tahun, berita.
 */
struct HomeView: View {
    @Environment(\.nav) private var nav
    @EnvironmentObject private var favorites: Favorites
    @StateObject private var live = Load { try await Api.shared.live($0) }
    @StateObject private var next = Load { try await Api.shared.nextSchedule($0) }
    @StateObject private var recent = Load { try await Api.shared.recent(page: 1, $0) }
    @StateObject private var birthdays = Load { try await Api.shared.birthdays($0) }
    @StateObject private var news = Load { try await Api.shared.news(page: 1, $0) }
    @StateObject private var videos = Load { try await Api.shared.videos($0) }

    var body: some View {
        Page(title: "JKT48Connect", refresh: {
            async let a: Void = live.refresh()
            async let b: Void = next.refresh()
            async let c: Void = recent.refresh()
            async let d: Void = videos.refresh()
            _ = await (a, b, c, d)
        }) {
            let show = next.data.flatMap { s in s.first { $0.category == "show" } ?? s.first }
            StatusCard(live: live.data, show: show)
                .padding(.horizontal, 16).padding(.top, 6)
            QuickActions().padding(.horizontal, 16).padding(.top, 14)

            if !favorites.all.isEmpty {
                SectionHead(micro: "Oshi kamu", title: "Favoritmu") { nav.tab(.members) }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        let liveNames = (live.data ?? []).map { $0.name.lowercased() }
                        ForEach(favorites.all) { f in
                            let n = f.name.lowercased()
                            let isLive = liveNames.contains { $0 == n || $0.hasPrefix(n + " ") }
                            NavigationLink(value: Route.member(id: f.id, name: f.name, img: f.img)) { FavoriteBubble(f: f, live: isLive) }.buttonStyle(Pressable())
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }

            if let list = live.data, !list.isEmpty {
                SectionHead(micro: "IDN Live · Showroom", title: "Live sekarang") { nav.tab(.live) }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(list) { l in LiveCard(live: l, height: 250).frame(width: UIScreen.main.bounds.width * 0.82) }
                    }
                    .padding(.horizontal, 16)
                }
            }

            SectionHead(micro: "YouTube JKT48 · JKT48 TV", title: "Video terbaru") { nav.push(.videos) }
            if let list = videos.data {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(list.prefix(8)) { v in
                            NavigationLink(value: Route.video(v)) { VideoCard(video: v, compact: true) }.buttonStyle(Pressable())
                                .frame(width: UIScreen.main.bounds.width * 0.72)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            } else if let e = videos.error {
                ErrorState(message: e) { Task { await videos.refresh() } }
            } else {
                Skeleton(height: 210).padding(.horizontal, 16)
            }

            SectionHead(micro: "Gift · supporter · replay", title: "Recent") { nav.tab(.recent) }
            if let list = recent.data?.items.prefix(5) {
                InsetGroup {
                    ForEach(Array(list.enumerated()), id: \.element.id) { i, r in
                        if i > 0 { GroupDivider(inset: 76) }
                        NavigationLink(value: Route.recent(r)) {
                            GroupRow(title: r.name, subtitle: "\(platformLabel(r.platform)) · \(Fmt.wib(r.start, "d MMM")) · \(Fmt.time(r.start))") {
                                RemoteImage(r.img, fallback: r.name, maxPixel: 200).frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            } trailing: {
                                Text(Fmt.duration(r.durationMs)).font(.display(20)).foregroundStyle(Theme.ink)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                Skeleton(height: 300).padding(.horizontal, 16)
            }

            if let list = birthdays.data, !list.isEmpty {
                SectionHead(micro: "Rayakan bersama", title: "Ulang tahun") { nav.push(.birthdays) }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(list) { b in
                            NavigationLink(value: Route.member(id: b.id, name: b.name, img: b.img)) { BirthdayBubble(b: b) }.buttonStyle(Pressable())
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }

            if let list = news.data?.items.prefix(4), !list.isEmpty {
                SectionHead(micro: "Dari jkt48.com", title: "Berita") { nav.push(.newsList) }
                InsetGroup {
                    ForEach(Array(list.enumerated()), id: \.element.id) { i, n in
                        if i > 0 { GroupDivider() }
                        NavigationLink(value: Route.news(n)) { GroupRow(title: n.title, subtitle: "\(n.category) · \(Fmt.wib(n.date, "d MMMM yyyy"))") }.buttonStyle(.plain)
                    }
                }
            }

            FanMadeFooter()
        }
        .task {
            async let a: Void = live.start()
            async let b: Void = next.start()
            async let c: Void = recent.start()
            async let d: Void = videos.start()
            async let e: Void = birthdays.start()
            async let f: Void = news.start()
            _ = await (a, b, c, d, e, f)
        }
    }
}

/// Kartu status merah: sapaan & tanggal, berapa member yang live, lalu show berikutnya dengan hitung mundur.
private struct StatusCard: View {
    let live: [LiveSession]?
    let show: TheaterShow?
    @Environment(\.nav) private var nav

    var body: some View {
        let hour = Calendar.current.dateComponents(in: Fmt.zone, from: Date()).hour ?? 12
        let greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam"
        let n = live?.count ?? 0
        VStack(alignment: .leading, spacing: 0) {
            Button { nav.tab(.live) } label: {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        PixelLogo(size: 20, color: .white)
                        Text("\(greet) · \(Fmt.wib(Date(), "EEE, d MMM"))".uppercased()).font(.mono(10, .semibold)).tracking(1.3).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
                        Spacer()
                        SignalBars(height: 12, active: n > 0)
                    }
                    .padding(.bottom, 20)
                    if live == nil {
                        RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.15)).frame(width: 180, height: 84)
                    } else if n > 0 {
                        Text("\(n) MEMBER").font(.display(44)).foregroundStyle(.white)
                        OutlineText("SEDANG LIVE", size: 44)
                        HStack {
                            AvatarStack(images: (live ?? []).map { $0.img.isEmpty ? $0.avatar : $0.img }, size: 30, max: 5, ring: Color(red: 0.82, green: 0.11, blue: 0.2), extraColor: .white)
                            Spacer()
                            HStack(spacing: 4) {
                                Text("Tonton").font(.system(size: 13, weight: .heavy))
                                Image(systemName: "arrow.right").font(.system(size: 13, weight: .bold))
                            }
                            .foregroundStyle(Theme.brand)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(.white, in: Capsule())
                        }
                        .padding(.top, 14)
                    } else {
                        Text("BELUM ADA").font(.display(44)).foregroundStyle(.white)
                        OutlineText("YANG LIVE", size: 44)
                        Text("Cek lagi nanti — tab Live diperbarui otomatis.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.82)).padding(.top, 8)
                    }
                }
                .padding(EdgeInsets(top: 18, leading: 20, bottom: 16, trailing: 20))
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())

            Rectangle().fill(.white.opacity(0.22)).frame(height: 1).padding(.horizontal, 20)

            Button {
                if let show { nav.push(.theater(id: show.id, title: show.title)) } else { nav.tab(.schedule) }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SHOW BERIKUTNYA").font(.mono(9.5, .semibold)).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                        if let show {
                            Text(show.title).font(.system(size: 17, weight: .heavy)).foregroundStyle(.white).lineLimit(1)
                            Text("\(Fmt.wib(show.date, "EEE, d MMM")) · \(Fmt.time(show.date))").font(.mono(11)).foregroundStyle(.white.opacity(0.7))
                        } else {
                            RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.15)).frame(width: 150, height: 18)
                        }
                    }
                    Spacer()
                    if let show, let d = Fmt.parse(show.date) {
                        HStack(spacing: 5) {
                            Image(systemName: "timer").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            Countdown(date: d)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 7)
                        .glass(tint: .black.opacity(0.25))
                    }
                }
                .padding(EdgeInsets(top: 14, leading: 20, bottom: 18, trailing: 16))
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())
        }
        .background(alignment: .topTrailing) {
            ZStack(alignment: .topTrailing) {
                Theme.brandGradient
                PixelLogo(size: 190, color: .white).rotationEffect(.degrees(18)).opacity(0.13).offset(x: 54, y: -36)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .shadow(color: Theme.brand.opacity(0.35), radius: 22, y: 10)
    }
}

/// Teks bergaris tepi (tanpa isi), seperti "SEDANG LIVE" di aplikasi Android.
struct OutlineText: View {
    let text: String
    let size: CGFloat
    init(_ text: String, size: CGFloat) {
        self.text = text
        self.size = size
    }
    var body: some View {
        ZStack {
            ForEach(0..<8) { i in
                let a = Double(i) * .pi / 4
                Text(text).font(.display(size)).foregroundStyle(.white).offset(x: cos(a) * 1.2, y: sin(a) * 1.2)
            }
            Text(text).font(.display(size)).foregroundStyle(Color(red: 0.86, green: 0.13, blue: 0.22))
        }
        .compositingGroup()
    }
}

/// Pintasan kaca: tiap tombol membal saat ditekan (Liquid Glass interaktif di iOS 26).
private struct QuickActions: View {
    @Environment(\.nav) private var nav
    var body: some View {
        let items: [(String, String, Route)] = [("play.rectangle.fill", "Video", .videos), ("bubble.left.and.bubble.right.fill", "Sosmed", .social()), ("gift.fill", "Ultah", .birthdays), ("newspaper.fill", "Berita", .newsList)]
        GlassGroup(spacing: 10) {
            HStack(spacing: 10) {
                ForEach(items, id: \.1) { item in
                    Button { nav.push(item.2) } label: {
                        VStack(spacing: 5) {
                            Image(systemName: item.0).font(.system(size: 20)).foregroundStyle(Theme.brand)
                            Text(item.1).font(.system(size: 12, weight: .heavy)).foregroundStyle(Theme.ink)
                        }
                        .frame(maxWidth: .infinity, minHeight: 72)
                        .contentShape(Rectangle())
                        .glassCard(22, interactive: true)
                    }
                    .buttonStyle(Pressable())
                }
            }
        }
    }
}

private struct FavoriteBubble: View {
    let f: Favorites.Fav
    let live: Bool
    var body: some View {
        VStack(spacing: 10) {
            ZStack(alignment: .bottom) {
                RemoteImage(f.img, fallback: f.name, maxPixel: 240)
                    .frame(width: 60, height: 60).clipShape(Circle())
                    .padding(2).background(Theme.bg, in: Circle())
                    .padding(3).background(live ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.line), in: Circle())
                if live {
                    Text("LIVE").font(.mono(8.5, .bold)).foregroundStyle(.white).padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Theme.brandGradient, in: Capsule()).offset(y: 6)
                }
            }
            Text(f.name).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
        }
        .frame(width: 72)
    }
}

/// Kotak abu berdenyut saat memuat.
struct Skeleton: View {
    var height: CGFloat
    var radius: CGFloat = 22
    @State private var dim = false
    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Theme.line.opacity(dim ? 0.18 : 0.32))
            .frame(height: height)
            .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever()) { dim = true } }
    }
}
