import SwiftUI

/// Grid member dengan kolom cari dan pilihan Aktif / Lulus / Favorit.
struct MembersView: View {
    @EnvironmentObject private var favorites: Favorites
    @StateObject private var members = Load { try await Api.shared.members($0) }
    @State private var q = ""
    @State private var seg = 0

    var body: some View {
        Page(title: "Member", refresh: { await members.refresh() }) {
            GlassSegmented(options: ["Aktif", "Lulus", "Favorit"], selection: $seg).padding(.top, 4).padding(.bottom, 14)
            LoadView(load: members) { all in
                let list = all
                    .filter { seg == 2 ? favorites.contains($0.id) : (seg == 0) != $0.isGraduate }
                    .filter { q.isEmpty || "\($0.name) \($0.nickname)".localizedCaseInsensitiveContains(q) }
                if list.isEmpty {
                    EmptyState(icon: seg == 2 ? "star" : "person.2", text: seg == 2 ? "Belum ada favorit.\nBuka profil member lalu ketuk bintang." : "Tidak ada member yang cocok.")
                        .padding(.horizontal, 16)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                        ForEach(list) { m in
                            NavigationLink(value: Route.member(id: m.id, name: m.name, img: m.img)) { MemberCard(m: m, fav: favorites.contains(m.id)) }
                                .buttonStyle(Pressable())
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .searchable(text: $q, prompt: "Cari oshi kamu…")
        .task { await members.start() }
    }
}

private struct MemberCard: View {
    let m: Member
    let fav: Bool
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Color.clear.aspectRatio(0.78, contentMode: .fit).overlay { RemoteImage(m.img, fallback: m.name, maxPixel: 500) }
            photoScrim
            VStack(alignment: .leading, spacing: 2) {
                Text((m.nickname.isEmpty ? m.name.split(separator: " ").first.map(String.init) ?? m.name : m.nickname).uppercased())
                    .font(.display(22)).foregroundStyle(.white).lineLimit(1)
                Text(m.name).font(.caption).foregroundStyle(.white.opacity(0.78)).lineLimit(1)
            }
            .padding(12)
            if fav {
                Image(systemName: "star.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 28, height: 28).glass(in: Circle(), tint: Theme.brand.opacity(0.8))
                    .padding(10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

/// Profil member: foto besar dengan panel kaca, data diri, total live, jikoshoukai, sosmed, theater.
struct MemberDetailView: View {
    let id: String
    let name: String
    let img: String
    @EnvironmentObject private var favorites: Favorites
    @StateObject private var data: Load<MemberDetail>
    @Environment(\.openURL) private var openURL

    init(id: String, name: String, img: String) {
        self.id = id
        self.name = name
        self.img = img
        _data = StateObject(wrappedValue: Load { try await Api.shared.member(id, $0) })
    }

    var body: some View {
        let m = data.data
        let short = m.map { $0.member.nickname.isEmpty ? $0.member.name : $0.member.nickname } ?? name
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottom) {
                    Color.clear.frame(height: UIScreen.main.bounds.height * 0.58)
                        .overlay { RemoteImage(m?.member.img ?? img, fallback: name, maxPixel: 1200) }
                        .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.55), .init(color: Theme.bg, location: 1)], startPoint: .top, endPoint: .bottom))
                        .clipped()
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Micro(m == nil ? "JKT48" : (m!.member.isGraduate ? "Lulus" : "Member aktif"), color: Theme.brand)
                            Text(short.uppercased()).font(.display(40)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.6)
                            Text(m.map { $0.fullname.isEmpty ? $0.member.name : $0.fullname } ?? name).font(.subheadline).foregroundStyle(Theme.inkSoft)
                        }
                        Spacer()
                        let fav = favorites.contains(id)
                        Button {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.5)) { favorites.toggle(id: id, name: short, img: m?.member.img ?? img) }
                        } label: {
                            Image(systemName: fav ? "star.fill" : "star").font(.system(size: 22, weight: .bold))
                                .foregroundStyle(fav ? .white : Theme.ink)
                                .frame(width: 50, height: 50)
                                .glass(in: Circle(), tint: fav ? Theme.brand : nil, interactive: true)
                                .scaleEffect(fav ? 1.1 : 1)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(fav ? "Hapus dari favorit" : "Jadikan favorit")
                    }
                    .padding(18)
                    .glassCard(28)
                    .padding(.horizontal, 16).padding(.bottom, 8)
                }

                LoadView(load: data) { m in
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(spacing: 8) {
                            fact("Lahir", m.birthdate.isEmpty ? "–" : Fmt.wib(m.birthdate, "d MMM yyyy"))
                            fact("Tinggi", m.height.isEmpty ? "–" : m.height)
                            fact("Gol. darah", m.bloodType.isEmpty ? "–" : m.bloodType)
                        }
                        if m.totalShowroom != nil || m.totalIdn != nil {
                            HStack(spacing: 10) {
                                StatBox(label: "Live Showroom", value: Fmt.compact(m.totalShowroom), accent: true)
                                StatBox(label: "Live IDN", value: Fmt.compact(m.totalIdn))
                            }
                        }
                        if !m.jikosokai.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Micro("Jikoshoukai", color: Theme.brand)
                                Text("“\(m.jikosokai)”").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink).lineSpacing(4)
                            }
                        }
                        if !m.socials.isEmpty {
                            GlassGroup(spacing: 8) {
                                LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], alignment: .leading, spacing: 8) {
                                    ForEach(Array(m.socials.enumerated()), id: \.offset) { _, so in
                                        Button { if let u = URL(string: so.url) { openURL(u) } } label: {
                                            HStack(spacing: 6) {
                                                Text(so.title).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
                                                Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.brand)
                                            }
                                            .frame(maxWidth: .infinity).padding(.vertical, 11)
                                            .glass(interactive: true)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Micro("Postingan sosmed", color: Theme.brand)
                            HStack(spacing: 8) {
                                ForEach([("x", "X"), ("tiktok", "TikTok"), ("instagram", "Instagram")], id: \.0) { pf in
                                    NavigationLink(value: Route.social(platform: pf.0, member: id, name: short)) {
                                        Text(pf.1).font(.system(size: 13, weight: .heavy)).foregroundStyle(Theme.ink)
                                            .frame(maxWidth: .infinity).padding(.vertical, 13)
                                            .glass(interactive: true)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        shows("Theater mendatang", m.upcomingShows.sorted { $0.date < $1.date })
                        shows("Theater terakhir", Array(m.recentShows.sorted { $0.date > $1.date }.prefix(5)))
                    }
                    .padding(16)
                }
            }
        }
        .background(Ambient())
        .ignoresSafeArea(edges: .top)
        .refreshable { await data.refresh() }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task { await data.start() }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Micro(label, size: 9)
            Text(value).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
        }
        .card(18, padding: 12)
    }

    @ViewBuilder
    private func shows(_ label: String, _ list: [TheaterShow]) -> some View {
        if !list.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Micro(label, color: Theme.brand)
                ForEach(list) { s in
                    NavigationLink(value: Route.theater(id: s.id, title: s.title)) { ShowTile(show: s) }.buttonStyle(Pressable())
                }
            }
        }
    }
}
