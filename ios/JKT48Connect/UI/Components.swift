import SwiftUI

/// Gelap di bawah foto supaya teks putih terbaca.
let photoScrim = LinearGradient(colors: [.black.opacity(0.05), .black.opacity(0.15), .black.opacity(0.78)], startPoint: .top, endPoint: .bottom)

/// Judul bagian: label mikro di atas, judul tebal, tombol "Semua" kaca di kanan.
struct SectionHead: View {
    let micro: String
    let title: String
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                Micro(micro)
                Text(title.uppercased()).font(.display(26)).foregroundStyle(Theme.ink)
            }
            Spacer()
            if let action {
                Button(action: action) {
                    HStack(spacing: 4) {
                        Text("Semua").font(.footnote.weight(.bold))
                        Image(systemName: "chevron.right").font(.caption2.weight(.bold))
                    }
                    .foregroundStyle(Theme.brand)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .glass(interactive: true)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 26)
        .padding(.bottom, 10)
    }
}

/// Bar sinyal kecil (live).
struct SignalBars: View {
    var color: Color = .white
    var height: CGFloat = 11
    var active = true
    @State private var on = false

    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(0..<4) { i in
                Capsule().fill(color.opacity(active ? 1 : 0.45))
                    .frame(width: 2.5, height: height * [0.4, 0.65, 0.85, 1][i] * (active && on && i % 2 == 1 ? 0.55 : 1))
            }
        }
        .frame(height: height, alignment: .bottom)
        .onAppear {
            guard active else { return }
            withAnimation(.easeInOut(duration: 0.6).repeatForever()) { on = true }
        }
    }
}

/// Deret foto bulat bertumpuk.
struct AvatarStack: View {
    let images: [String]
    var size: CGFloat = 26
    var max = 6
    var ring: Color = Theme.card
    var extraColor: Color = Theme.inkSoft

    var body: some View {
        let shown = Array(images.prefix(max))
        HStack(spacing: -size * 0.32) {
            ForEach(Array(shown.enumerated()), id: \.offset) { _, url in
                RemoteImage(url, maxPixel: size * 3).frame(width: size, height: size).clipShape(Circle()).overlay(Circle().stroke(ring, lineWidth: 2))
            }
            if images.count > shown.count {
                Text("+\(images.count - shown.count)").font(.mono(11)).foregroundStyle(extraColor).padding(.leading, size * 0.32 + 4)
            }
        }
    }
}

/// Pil kategori show (Show / Event / dll).
struct CategoryPill: View {
    let text: String
    var body: some View {
        Text((text.isEmpty ? "show" : text).uppercased())
            .font(.mono(9.5, .bold)).tracking(1)
            .foregroundStyle(text == "event" ? Theme.butterInk : Theme.brand)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((text == "event" ? Theme.butter : Theme.brand.opacity(0.12)), in: Capsule())
    }
}

/// Hitung mundur yang berdetak tiap detik.
struct Countdown: View {
    let date: Date
    var font: Font = .mono(12, .semibold)
    var color: Color = .white
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            Text(Fmt.countdown(to: date, now: ctx.date)).font(font).foregroundStyle(color).monospacedDigit()
        }
    }
}

/// Logo piksel JKT48Connect (salib piksel), digambar sebagai Canvas.
struct PixelLogo: View {
    var size: CGFloat = 20
    var color: Color = Theme.brand
    private static let cells: [(Int, Int)] = [(2, 0), (2, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (2, 3), (2, 4), (1, 1), (3, 3)]
    var body: some View {
        Canvas { ctx, s in
            let u = s.width / 5
            for (x, y) in Self.cells {
                ctx.fill(Path(roundedRect: CGRect(x: CGFloat(x) * u + u * 0.08, y: CGFloat(y) * u + u * 0.08, width: u * 0.84, height: u * 0.84), cornerRadius: u * 0.18), with: .color(color))
            }
        }
        .frame(width: size, height: size)
    }
}

/// Kartu besar member yang live: foto penuh, pil kaca merah "LIVE". Showroom → tonton di aplikasi; IDN → buka idn.app.
struct LiveCard: View {
    let live: LiveSession
    var height: CGFloat = 260
    @Environment(\.openURL) private var openURL

    var body: some View {
        let content = ZStack(alignment: .topLeading) {
            RemoteImage(live.photo, fallback: live.name)
            photoScrim
            HStack(spacing: 7) {
                SignalBars()
                Text("LIVE · \(platformLabel(live.platform).uppercased())").font(.mono(10.5, .bold)).tracking(1.2).foregroundStyle(.white)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .glass(tint: Theme.brand.opacity(0.75))
            .padding(14)

            HStack(spacing: 5) {
                Image(systemName: live.watchable ? "play.fill" : "arrow.up.right").font(.system(size: 11, weight: .bold))
                Text(live.watchable ? "TONTON" : "BUKA IDN").font(.mono(10.5, .bold)).tracking(1.2)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 11).padding(.vertical, 7)
            .glass()
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .trailing)

            VStack(alignment: .leading, spacing: 4) {
                Text(live.name.uppercased()).font(.display(32)).foregroundStyle(.white).lineLimit(1)
                Text([live.title, Fmt.ago(live.startedAt)].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.footnote).foregroundStyle(.white.opacity(0.78)).lineLimit(1)
            }
            .padding(18)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        }
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

        if live.watchable {
            NavigationLink(value: Route.watch(live)) { content }.buttonStyle(Pressable())
        } else {
            Button { if let u = URL(string: live.link) { openURL(u) } } label: { content }.buttonStyle(Pressable())
        }
    }
}

/// Efek tekan: mengecil sedikit & membal.
struct Pressable: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// Kartu isi standar (kaca di atas latar ambient).
extension View {
    func card(_ radius: CGFloat = 24, padding: CGFloat = 12) -> some View {
        self.padding(padding).frame(maxWidth: .infinity, alignment: .leading).glassCard(radius)
    }
}

/// Kartu jadwal: tanggal besar (merah bila < 24 jam lagi), kategori, jam, judul, avatar member.
struct ShowTile: View {
    let show: TheaterShow
    var body: some View {
        let date = Fmt.parse(show.date)
        let left = date.map { $0.timeIntervalSinceNow } ?? -1
        let soon = left >= 0 && left < 86400
        HStack(spacing: 14) {
            VStack(spacing: 2) {
                Text(Fmt.wib(show.date, "d")).font(.display(28)).foregroundStyle(soon ? .white : Theme.ink)
                Text(Fmt.wib(show.date, "MMM").uppercased()).font(.mono(9.5, .semibold)).tracking(1).foregroundStyle(soon ? .white.opacity(0.75) : Theme.inkSoft)
            }
            .frame(width: 60)
            .padding(.vertical, 10)
            .background(soon ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.bg.opacity(0.7)), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    CategoryPill(text: show.category)
                    Text(Fmt.time(show.date)).font(.mono(11)).foregroundStyle(Theme.inkSoft)
                }
                Text(show.title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(2).multilineTextAlignment(.leading)
                if !show.members.isEmpty { AvatarStack(images: show.members.map(\.img)) }
            }
            Spacer(minLength: 0)
        }
        .card()
    }
}

/// Baris rekap live: foto, platform, nama, tanggal, durasi, penonton.
struct RecentTile: View {
    let r: RecentLive
    var body: some View {
        HStack(spacing: 14) {
            RemoteImage(r.img, fallback: r.name, maxPixel: 240).frame(width: 62, height: 74).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Micro(platformLabel(r.platform), color: r.platform == "idn" ? Theme.brand : Theme.inkSoft)
                Text(r.name).font(.system(size: 16, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1)
                Text("\(Fmt.wib(r.start, "d MMM")) · \(Fmt.time(r.start))").font(.mono(11)).foregroundStyle(Theme.inkSoft)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 4) {
                Text(Fmt.duration(r.durationMs)).font(.display(22)).foregroundStyle(Theme.ink)
                Label(Fmt.compact(r.viewers), systemImage: "eye").font(.mono(11)).foregroundStyle(Theme.inkSoft).labelStyle(.titleAndIcon)
            }
            .padding(.trailing, 6)
        }
        .card(24, padding: 10)
    }
}

struct NewsTile: View {
    let n: NewsItem
    var index: Int?
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let index { Text(String(format: "%02d", index + 1)).font(.mono(12, .semibold)).foregroundStyle(Theme.brand).frame(width: 26, alignment: .leading) }
            VStack(alignment: .leading, spacing: 4) {
                Micro(n.category)
                Text(n.title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(2).multilineTextAlignment(.leading)
                Text(Fmt.wib(n.date, "d MMMM yyyy")).font(.mono(11)).foregroundStyle(Theme.inkSoft)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right").font(.caption.weight(.bold)).foregroundStyle(Theme.brand)
                .frame(width: 30, height: 30).background(Theme.bg.opacity(0.7), in: Circle())
        }
        .card(22, padding: 14)
    }
}

struct BirthdayBubble: View {
    let b: Birthday
    var body: some View {
        let days = b.next.map { Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: $0.date).day ?? 0 } ?? 0
        VStack(spacing: 4) {
            RemoteImage(b.img, fallback: b.name, maxPixel: 240)
                .frame(width: 68, height: 68).clipShape(Circle())
                .padding(3)
                .background(days == 0 ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.line.opacity(0.5)), in: Circle())
            Text(b.name.split(separator: " ").first.map(String.init) ?? b.name).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(1)
            Micro(days == 0 ? "Hari ini" : "\(days) hari", color: days == 0 ? Theme.brand : Theme.inkSoft, size: 9.5)
        }
        .frame(width: 82)
    }
}

/// Kotak statistik kecil.
struct StatBox: View {
    let label: String
    let value: String
    var accent = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Micro(label, color: accent ? .white.opacity(0.75) : Theme.inkSoft, size: 9.5)
            Text(value).font(.display(24)).foregroundStyle(accent ? .white : Theme.ink).lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(StatBg(accent: accent))
    }
}

private struct StatBg: ViewModifier {
    let accent: Bool
    @ViewBuilder
    func body(content: Content) -> some View {
        if accent {
            content.background(Theme.brandGradient, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        } else {
            content.glassCard(22)
        }
    }
}

/// Grup baris bergaya pengaturan iOS, dibungkus kaca.
struct InsetGroup<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) { content }
            .glassCard(24)
            .padding(.horizontal, 16)
    }
}

struct GroupRow<Leading: View, Trailing: View>: View {
    let title: String
    var subtitle = ""
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(2).multilineTextAlignment(.leading)
                if !subtitle.isEmpty { Text(subtitle).font(.mono(11)).foregroundStyle(Theme.inkSoft).lineLimit(1) }
            }
            Spacer(minLength: 0)
            trailing
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .contentShape(Rectangle())
    }
}

extension GroupRow where Leading == EmptyView, Trailing == EmptyView {
    init(title: String, subtitle: String = "") {
        self.init(title: title, subtitle: subtitle, leading: { EmptyView() }, trailing: { EmptyView() })
    }
}

struct GroupDivider: View {
    var inset: CGFloat = 14
    var body: some View { Rectangle().fill(Theme.line.opacity(0.6)).frame(height: 0.5).padding(.leading, inset) }
}

/// Segmented kaca (pilihan tab dalam halaman). Pil aktif berpindah dengan animasi (matchedGeometryEffect).
struct GlassSegmented: View {
    let options: [String]
    @Binding var selection: Int
    @Namespace private var ns

    var body: some View {
        GlassGroup(spacing: 4) {
            HStack(spacing: 4) {
                ForEach(options.indices, id: \.self) { i in
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { selection = i }
                    } label: {
                        Text(options[i])
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(selection == i ? .white : Theme.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background {
                                if selection == i {
                                    Capsule().fill(Theme.brandGradient).matchedGeometryEffect(id: "seg", in: ns)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .glass(interactive: true)
        }
        .padding(.horizontal, 16)
    }
}

/// Footer kecil "fan-made".
struct FanMadeFooter: View {
    var body: some View {
        VStack(spacing: 10) {
            PixelLogo(size: 18)
            Text("Fan-made · tidak berafiliasi dengan JKT48 Operation Team").font(.mono(10.5)).foregroundStyle(Theme.inkSoft).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 28)
        .padding(.bottom, 24)
    }
}
