import SwiftUI

/// Tab Live: semua member yang sedang live. Showroom ditonton di aplikasi; IDN dibuka di idn.app.
struct LiveView: View {
    @StateObject private var live = Load { try await Api.shared.live($0) }

    var body: some View {
        Page(title: "Live", refresh: { await live.refresh() }) {
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill").foregroundStyle(Theme.brand)
                Text("Live Showroom bisa langsung ditonton di sini. Live IDN dibuka di aplikasi/situs IDN.")
                    .font(.footnote).foregroundStyle(Theme.inkSoft)
            }
            .card(18, padding: 12)
            .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 14)

            LoadView(load: live) { list in
                if list.isEmpty {
                    EmptyState(icon: "dot.radiowaves.left.and.right", text: "Belum ada member yang live.\nTarik ke bawah untuk memeriksa lagi.")
                        .padding(.horizontal, 16)
                } else {
                    VStack(spacing: 14) {
                        ForEach(list) { l in LiveCard(live: l, height: 300) }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .task { await live.start() }
        .task {
            // Daftar live diperbarui tiap 30 detik selama tab terbuka.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                await live.refresh()
            }
        }
    }
}

/**
 Menonton live Showroom di aplikasi (HLS langsung dari CDN Showroom). Daftar live diperiksa tiap 30 detik:
 bila sesi hilang, siaran dianggap selesai; URL stream terbaru dipakai bila berubah.
 */
struct WatchView: View {
    @State var live: LiveSession
    @State private var quality = 0
    @State private var others: [LiveSession] = []
    @State private var gone = false
    @Environment(\.openURL) private var openURL
    @Environment(\.nav) private var nav

    init(live: LiveSession) { _live = State(initialValue: live) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if live.streams.isEmpty {
                    Text("Live ini tidak bisa diputar di aplikasi.").font(.headline).card(22, padding: 20)
                } else {
                    let s = live.streams[min(quality, live.streams.count - 1)]
                    PlayerFrame(ratio: 9 / 16) {
                        if let u = URL(string: s.url) { VideoPlayerView(url: u, live: true) }
                    }
                    .frame(maxHeight: 560)
                    .frame(maxWidth: .infinity)
                    if live.streams.count > 1 {
                        GlassSegmented(options: live.streams.map(\.shortLabel), selection: $quality).padding(.horizontal, -16)
                    }
                }
                if gone {
                    Text("Siaran ini sudah tidak ada di daftar live. Rekamannya akan muncul di Recent.").font(.footnote).foregroundStyle(Theme.inkSoft)
                }

                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 14) {
                        RemoteImage(live.img.isEmpty ? live.avatar : live.img, fallback: live.name, maxPixel: 240)
                            .frame(width: 58, height: 58).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Micro(platformLabel(live.platform) + (gone ? "" : " · Live"), color: Theme.brand)
                            Text(live.name.uppercased()).font(.display(26)).foregroundStyle(Theme.ink).lineLimit(1)
                            Text("Mulai \(Fmt.time(live.startedAt)) · \(Fmt.ago(live.startedAt))").font(.mono(11)).foregroundStyle(Theme.inkSoft)
                        }
                    }
                    if !live.title.isEmpty { Text("“\(live.title)”").font(.system(size: 15)).foregroundStyle(Theme.ink) }
                    Button { if let u = URL(string: live.link) { openURL(u) } } label: {
                        Label("Buka di Showroom", systemImage: "arrow.up.right").font(.footnote.weight(.bold)).foregroundStyle(Theme.inkSoft)
                    }
                    .buttonStyle(.plain)
                }
                .card(24, padding: 16)

                if !others.isEmpty {
                    Micro("Live lainnya").padding(.leading, 4).padding(.top, 6)
                    ForEach(others) { o in
                        Button {
                            if o.watchable { nav.push(.watch(o)) } else if let u = URL(string: o.link) { openURL(u) }
                        } label: {
                            HStack(spacing: 12) {
                                RemoteImage(o.img.isEmpty ? o.avatar : o.img, fallback: o.name, maxPixel: 160).frame(width: 44, height: 44).clipShape(Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(o.name).font(.system(size: 15, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1)
                                    Text(o.watchable ? "Showroom · tonton di aplikasi" : "\(platformLabel(o.platform)) · dibuka di \(platformLabel(o.platform))")
                                        .font(.caption).foregroundStyle(Theme.inkSoft).lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: o.watchable ? "play.fill" : "arrow.up.right")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(o.watchable ? .white : Theme.ink)
                                    .frame(width: 34, height: 34)
                                    .background(o.watchable ? AnyShapeStyle(Theme.brand) : AnyShapeStyle(Theme.inkSoft.opacity(0.15)), in: Circle())
                            }
                            .card(22, padding: 12)
                        }
                        .buttonStyle(Pressable())
                    }
                }
            }
            .padding(16)
        }
        .background(Ambient())
        .navigationTitle(live.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            while !Task.isCancelled {
                if let list = try? await Api.shared.live() {
                    let now = list.first { $0.id == live.id }
                    if let now, now.watchable, now.streams != live.streams { live = now }
                    gone = now == nil
                    others = list.filter { $0.id != live.id }
                }
                try? await Task.sleep(nanoseconds: 30_000_000_000)
            }
        }
    }
}
