import SwiftUI

/// Berita dari jkt48.com, berhalaman.
struct NewsView: View {
    @StateObject private var news = PagedLoad { try await Api.shared.news(page: $0, $1) }

    var body: some View {
        Page(title: "Berita", large: false, refresh: { await news.refresh() }) {
            Color.clear.frame(height: 8)
            PagedList(load: news) { n in
                NavigationLink(value: Route.news(n)) { NewsTile(n: n) }.buttonStyle(Pressable())
            }
        }
        .task { await news.start() }
    }
}

/// Isi berita sebagai teks (HTML disederhanakan), plus tautan ke jkt48.com.
struct NewsDetailView: View {
    let item: NewsItem
    @StateObject private var detail: Load<NewsItem>
    @Environment(\.openURL) private var openURL

    init(item: NewsItem) {
        self.item = item
        let id = item.id
        _detail = StateObject(wrappedValue: Load { try await Api.shared.newsDetail(id, $0) })
    }

    var body: some View {
        let n = detail.data ?? item
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Micro(n.category, color: Theme.brand)
                Text(n.title).font(.system(size: 24, weight: .heavy)).foregroundStyle(Theme.ink)
                Text(Fmt.wib(n.date, "EEEE, d MMMM yyyy")).font(.mono(12)).foregroundStyle(Theme.inkSoft)
                if detail.data == nil && detail.error == nil {
                    Skeleton(height: 220)
                } else {
                    let text = Fmt.plain(n.content)
                    Text(text.isEmpty ? "Isi berita tidak tersedia. Buka di jkt48.com untuk membaca selengkapnya." : text)
                        .font(.system(size: 16)).foregroundStyle(Theme.ink).lineSpacing(5).textSelection(.enabled)
                        .card(24, padding: 18)
                }
                if let u = URL(string: n.url), !n.url.isEmpty {
                    GlassButton(prominent: true, action: { openURL(u) }) {
                        Label("Buka di jkt48.com", systemImage: "arrow.up.right").font(.subheadline.weight(.bold)).frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(20)
        }
        .background(Ambient())
        .navigationTitle("Berita")
        .navigationBarTitleDisplayMode(.inline)
        .task { await detail.start() }
    }
}

/// Ulang tahun member terdekat.
struct BirthdaysView: View {
    @StateObject private var list = Load { try await Api.shared.birthdays($0) }

    var body: some View {
        Page(title: "Ulang tahun", large: false, refresh: { await list.refresh() }) {
            LoadView(load: list) { items in
                VStack(spacing: 10) {
                    ForEach(items) { b in
                        NavigationLink(value: Route.member(id: b.id, name: b.name, img: b.img)) { row(b) }.buttonStyle(Pressable())
                    }
                }
                .padding(16)
            }
        }
        .task { await list.start() }
    }

    private func row(_ b: Birthday) -> some View {
        let next = b.next
        let days = next.map { Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: $0.date).day ?? 0 }
        let today = days == 0
        return HStack(spacing: 14) {
            RemoteImage(b.img, fallback: b.name, maxPixel: 240).frame(width: 58, height: 58).clipShape(Circle())
                .padding(3).background(today ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Color.clear), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(b.name).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1)
                if let next {
                    Text("\(Fmt.wib(next.date, "EEEE, d MMMM")) · \(next.age) tahun").font(.mono(11)).foregroundStyle(Theme.inkSoft)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 0) {
                if today {
                    Image(systemName: "gift.fill").font(.system(size: 22)).foregroundStyle(Theme.brand)
                    Micro("Hari ini", color: Theme.brand, size: 9.5)
                } else if let days {
                    Text("\(days)").font(.display(28)).foregroundStyle(Theme.ink)
                    Micro("hari lagi", size: 9.5)
                }
            }
        }
        .card(24, padding: 12)
    }
}

/// Tentang aplikasi: pembuat, saluran JKT48Connect, sumber data, dan cara memasang ulang (sideload).
struct AboutView: View {
    @Environment(\.openURL) private var openURL
    private let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"

    private let ecosystem: [(String, String, String, String)] = [
        ("globe", "Situs web", "Live, jadwal, rekap, dan replay di browser.", "https://jkt48connect.app"),
        ("xmark", "Bot X @JKT48Connect", "Notifikasi member live di IDN & Showroom, plus jadwal theater harian.", "https://x.com/JKT48Connect"),
        ("bubble.left.and.bubble.right", "Bot Discord", "Notifikasi live & jadwal untuk server fanbase.", "https://discord.com/discovery/applications/1305141693477027891"),
        ("chevron.left.forwardslash.chevron.right", "Public API", "Data yang sama, terbuka untuk aplikasi & bot komunitas.", "https://api.jkt48connect.app/docs"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    PixelLogo(size: 34, color: .white).padding(.bottom, 10)
                    Text("JKT48").font(.display(38)).foregroundStyle(.white)
                    Text("CONNECT").font(.display(38)).foregroundStyle(Color(red: 0.1, green: 0.02, blue: 0.03))
                    Text("Live, jadwal theater, rekap, dan replay member JKT48 dalam satu aplikasi.").font(.subheadline).foregroundStyle(.white.opacity(0.85)).padding(.top, 6)
                    Text("iOS · versi \(version)").font(.mono(11)).foregroundStyle(.white.opacity(0.7)).padding(.top, 4)
                }
                .padding(22)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 30, style: .continuous))

                HStack(spacing: 14) {
                    Text("V").font(.display(30)).foregroundStyle(.white).frame(width: 56, height: 56).background(Theme.brandGradient, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Valzyys").font(.display(24)).foregroundStyle(Theme.ink)
                        Text("@Valzyys · Developer JKT48Connect").font(.mono(12)).foregroundStyle(Theme.inkSoft)
                    }
                    Spacer()
                    GlassButton(prominent: true, action: { openURL(URL(string: "https://x.com/valzyys")!) }) {
                        Text("Ikuti").font(.subheadline.weight(.heavy))
                    }
                }
                .card(26, padding: 16)

                Micro("Ekosistem JKT48Connect", color: Theme.brand).padding(.top, 8)
                VStack(spacing: 0) {
                    ForEach(Array(ecosystem.enumerated()), id: \.offset) { i, e in
                        if i > 0 { GroupDivider(inset: 58) }
                        Button { openURL(URL(string: e.3)!) } label: {
                            GroupRow(title: e.1, subtitle: "") {
                                Image(systemName: e.0).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.brand)
                                    .frame(width: 32, height: 32).background(Theme.brand.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            } trailing: {
                                Image(systemName: "arrow.up.right").font(.caption.weight(.bold)).foregroundStyle(Theme.inkSoft)
                            }
                        }
                        .buttonStyle(.plain)
                        Text(e.2).font(.caption).foregroundStyle(Theme.inkSoft).frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 58).padding(.trailing, 14).padding(.bottom, 10).padding(.top, -6)
                    }
                }
                .glassCard(24)

                Micro("Memasang ulang aplikasi", color: Theme.brand).padding(.top, 8)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Aplikasi ini dipasang lewat sideload. Untuk update, tambahkan repo JKT48Connect di Scarlet / ESign / Feather / SideStore, atau unduh file .ipa terbaru lalu buka dengan aplikasi tersebut. Kalau aplikasi tiba-tiba tidak bisa dibuka, sertifikat pemasangnya kedaluwarsa: pasang ulang saja, data tetap tersimpan.")
                        .font(.footnote).foregroundStyle(Theme.ink)
                    Button { openURL(URL(string: "https://github.com/Valzyys/JKT48Connet-REVAMP/blob/main/ios/README.md#memasang-ipa")!) } label: {
                        Label("Panduan pasang & update", systemImage: "arrow.down.circle.fill").font(.footnote.weight(.heavy)).foregroundStyle(Theme.brand)
                    }
                    .buttonStyle(.plain)
                }
                .card(22, padding: 16)

                Text("Data dari jkt48.com, IDN Live, dan Showroom. Fan-made, tidak berafiliasi dengan JKT48 Operation Team, IDN, maupun Showroom.")
                    .font(.caption).foregroundStyle(Theme.inkSoft).padding(.top, 4)
                FanMadeFooter()
            }
            .padding(16)
        }
        .background(Ambient())
        .navigationTitle("Tentang")
        .navigationBarTitleDisplayMode(.inline)
    }
}
