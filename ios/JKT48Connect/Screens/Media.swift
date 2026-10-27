import SwiftUI

/// Video terbaru YouTube JKT48 & JKT48 TV.
struct VideosView: View {
    @StateObject private var videos = Load { try await Api.shared.videos($0) }

    var body: some View {
        Page(title: "Video", large: false, refresh: { await videos.refresh() }) {
            LoadView(load: videos) { list in
                VStack(spacing: 16) {
                    ForEach(list) { v in
                        NavigationLink(value: Route.video(v)) { VideoCard(video: v) }.buttonStyle(Pressable())
                    }
                }
                .padding(16)
            }
        }
        .task { await videos.start() }
    }
}

struct VideoCard: View {
    let video: Video
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                Color.clear.aspectRatio(16 / 9, contentMode: .fit).overlay { RemoteImage(video.thumbnail, maxPixel: compact ? 700 : 1100) }
                Image(systemName: "play.fill").font(.system(size: compact ? 16 : 20, weight: .bold)).foregroundStyle(.white)
                    .frame(width: compact ? 42 : 54, height: compact ? 42 : 54)
                    .glass(in: Circle(), tint: Theme.brand.opacity(0.7))
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(video.title).font(.system(size: compact ? 14 : 16, weight: .bold)).foregroundStyle(Theme.ink).lineLimit(2).multilineTextAlignment(.leading)
                Text([video.channel, video.views.map { "\(Fmt.compact($0)) x ditonton" } ?? "", Fmt.ago(video.date)].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(Theme.inkSoft).lineLimit(1)
            }
            .padding(.horizontal, 4)
        }
        .padding(compact ? 8 : 10)
        .glassCard(26)
    }
}

/// Detail video: pemutar HLS di aplikasi (tiket server ±3 jam), deskripsi, komentar.
struct VideoDetailView: View {
    let video: Video
    @StateObject private var detail: Load<VideoDetail>
    @State private var comments: [VideoComment] = []
    @State private var cursor = ""
    @State private var hasMore = false
    @State private var loadingComments = true
    @State private var expanded = false
    @Environment(\.openURL) private var openURL

    init(video: Video) {
        self.video = video
        let id = video.id
        _detail = StateObject(wrappedValue: Load { try await Api.shared.video(id, $0) })
    }

    var body: some View {
        let d = detail.data
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PlayerFrame {
                    if let u = d?.freshPlayback {
                        VideoPlayerView(url: u)
                    } else {
                        RemoteImage(video.thumbnail, maxPixel: 1200)
                        if d == nil && detail.error == nil {
                            Color.black.opacity(0.35)
                            ProgressView().tint(.white)
                        } else {
                            Button { if let u = URL(string: video.url) { openURL(u) } } label: {
                                ZStack {
                                    Color.black.opacity(0.5)
                                    VStack(spacing: 10) {
                                        Image(systemName: "play.fill").font(.system(size: 22, weight: .bold)).foregroundStyle(.white).frame(width: 54, height: 54).background(Theme.brand, in: Circle())
                                        Text("Tidak bisa diputar di aplikasi · buka di YouTube").font(.footnote.weight(.bold)).foregroundStyle(.white)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(video.title).font(.system(size: 20, weight: .heavy)).foregroundStyle(Theme.ink)
                    HStack(spacing: 8) {
                        Text(video.channel.isEmpty ? "JKT48" : video.channel).font(.caption.weight(.bold)).foregroundStyle(Theme.brand)
                            .padding(.horizontal, 10).padding(.vertical, 4).background(Theme.brand.opacity(0.12), in: Capsule())
                        Text([video.views.map { "\(Fmt.compact($0)) x ditonton" }, d?.duration.map { Fmt.clock($0) }, Fmt.wib(video.date, "d MMM yyyy")].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(Theme.inkSoft).lineLimit(1)
                    }
                    GlassButton(action: { if let u = URL(string: video.url) { openURL(u) } }) {
                        Label("Buka di YouTube", systemImage: "arrow.up.right").font(.subheadline.weight(.bold))
                    }
                    .padding(.top, 6)
                }

                if let desc = d?.description, !desc.isEmpty {
                    Button { withAnimation { expanded.toggle() } } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(desc).font(.system(size: 14)).foregroundStyle(Theme.ink).lineLimit(expanded ? nil : 4).multilineTextAlignment(.leading)
                            Text(expanded ? "Lebih sedikit" : "Selengkapnya").font(.footnote.weight(.heavy)).foregroundStyle(Theme.brand)
                        }
                        .card(20, padding: 16)
                    }
                    .buttonStyle(.plain)
                }

                HStack(alignment: .bottom) {
                    Text("Komentar").font(.system(size: 21, weight: .heavy)).foregroundStyle(Theme.ink)
                    Spacer()
                    if let n = d?.comments { Text(Fmt.compact(n)).font(.subheadline.weight(.bold)).foregroundStyle(Theme.inkSoft) }
                }
                .padding(.top, 8)

                if comments.isEmpty {
                    if loadingComments { Skeleton(height: 72, radius: 18) } else { Text("Belum ada komentar (atau komentar dinonaktifkan).").font(.subheadline).foregroundStyle(Theme.inkSoft) }
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(comments.enumerated()), id: \.offset) { i, c in
                            if i > 0 { GroupDivider(inset: 62) }
                            CommentRow(c: c)
                        }
                    }
                    .glassCard(20)
                    if hasMore {
                        GlassButton(action: { Task { await loadComments() } }) {
                            Text(loadingComments ? "Memuat…" : "Muat komentar lainnya").font(.subheadline.weight(.heavy)).foregroundStyle(Theme.brand).frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Ambient())
        .navigationTitle("Video")
        .navigationBarTitleDisplayMode(.inline)
        .task { await detail.start() }
        .task { await loadComments() }
    }

    private func loadComments() async {
        loadingComments = true
        defer { loadingComments = false }
        guard let page = try? await Api.shared.videoComments(video.id, cursor: cursor) else { return }
        comments += page.items
        cursor = page.cursor
        hasMore = page.hasMore && !page.cursor.isEmpty
    }
}

private struct CommentRow: View {
    let c: VideoComment
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            RemoteImage(c.avatar, fallback: c.author.replacingOccurrences(of: "@", with: ""), maxPixel: 120).frame(width: 36, height: 36).clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 0) {
                    Text(c.author).font(.system(size: 13, weight: .heavy)).foregroundStyle(c.uploader ? Theme.brand : Theme.ink).lineLimit(1)
                    Text(" · \(c.when)").font(.caption).foregroundStyle(Theme.inkSoft).lineLimit(1)
                }
                Text(c.text).font(.system(size: 14)).foregroundStyle(Theme.ink)
                if (c.likes ?? 0) > 0 || (c.replies ?? 0) > 0 {
                    HStack(spacing: 14) {
                        if let l = c.likes, l > 0 { Label(Fmt.compact(l), systemImage: "hand.thumbsup") }
                        if let r = c.replies, r > 0 { Label(Fmt.compact(r), systemImage: "bubble.left") }
                    }
                    .font(.caption).foregroundStyle(Theme.inkSoft).padding(.top, 3)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }
}

/// Posting member di X, TikTok, dan Instagram (arsip publik), bisa disaring per member.
struct SocialView: View {
    let member: String
    let memberName: String
    @State private var seg: Int
    @State private var items: [SocialPost] = []
    @State private var cursor = ""
    @State private var hasMore = true
    @State private var loading = false
    @State private var error: String?
    private static let platforms = [("x", "X"), ("tiktok", "TikTok"), ("instagram", "Instagram")]

    init(platform: String, member: String, memberName: String) {
        self.member = member
        self.memberName = memberName
        _seg = State(initialValue: max(0, Self.platforms.firstIndex { $0.0 == platform } ?? 0))
    }

    var body: some View {
        Page(title: memberName.isEmpty ? "Sosmed" : "Sosmed \(memberName)", large: false, refresh: { await load(reset: true) }) {
            GlassSegmented(options: Self.platforms.map(\.1), selection: $seg).padding(.vertical, 12)
            if items.isEmpty && loading {
                ForEach(0..<3, id: \.self) { _ in Skeleton(height: 260).padding(.horizontal, 16).padding(.bottom, 12) }
            } else if items.isEmpty, let error {
                ErrorState(message: error) { Task { await load(reset: true) } }
            } else if items.isEmpty {
                EmptyState(icon: "bubble.left.and.bubble.right", text: "Belum ada posting.").padding(.horizontal, 16)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { i, p in
                PostCard(p: p)
                    .padding(.horizontal, 16).padding(.bottom, 12)
                    .onAppear { if i == items.count - 1 { Task { await load(reset: false) } } }
            }
            if loading && !items.isEmpty { ProgressView().frame(maxWidth: .infinity).padding() }
        }
        .task(id: seg) { await load(reset: true) }
    }

    private func load(reset: Bool) async {
        if loading || (!reset && !hasMore) { return }
        loading = true
        defer { loading = false }
        if reset {
            cursor = ""
            hasMore = true
        }
        do {
            let page = try await Api.shared.social(Self.platforms[seg].0, member: member, before: cursor, reset ? .force : .normal)
            items = reset ? page.items : items + page.items
            cursor = page.cursor
            hasMore = page.hasMore && !page.cursor.isEmpty
            error = nil
        } catch {
            if reset { items = [] }
            self.error = error.localizedDescription
            hasMore = false
        }
    }
}

/// Kartu posting: kepala (member, platform, waktu), teks, media, metrik. Ketuk → buka posting asli.
struct PostCard: View {
    let p: SocialPost
    @Environment(\.openURL) private var openURL
    @Environment(\.nav) private var nav

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button { if !p.memberId.isEmpty { nav.push(.member(id: p.memberId, name: p.memberName, img: p.memberImg)) } } label: {
                HStack(spacing: 10) {
                    RemoteImage(p.memberImg.isEmpty ? p.avatar : p.memberImg, fallback: p.memberName, maxPixel: 120).frame(width: 38, height: 38).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(p.memberName.isEmpty ? p.authorName : p.memberName).font(.system(size: 14, weight: .heavy)).foregroundStyle(Theme.ink).lineLimit(1)
                        Text("@\(p.username) · \(Fmt.ago(p.date))").font(.caption).foregroundStyle(Theme.inkSoft).lineLimit(1)
                    }
                    Spacer()
                    Text(p.platformLabel).font(.mono(10, .bold)).foregroundStyle(Theme.inkSoft).padding(.horizontal, 8).padding(.vertical, 4).glass()
                }
            }
            .buttonStyle(.plain)
            if !p.text.isEmpty {
                Text(p.text).font(.system(size: 14.5)).foregroundStyle(Theme.ink).lineLimit(8)
            }
            if !p.media.isEmpty { media }
            HStack(spacing: 16) {
                if let v = p.likes { Label(Fmt.compact(v), systemImage: "heart") }
                if let v = p.comments { Label(Fmt.compact(v), systemImage: "bubble.left") }
                if let v = p.views { Label(Fmt.compact(v), systemImage: "eye") }
                Spacer()
                Button { if let u = URL(string: p.url) { openURL(u) } } label: {
                    Label("Buka", systemImage: "arrow.up.right").font(.caption.weight(.heavy)).foregroundStyle(Theme.brand)
                }
                .buttonStyle(.plain)
            }
            .font(.caption).foregroundStyle(Theme.inkSoft)
        }
        .card(24, padding: 14)
    }

    @ViewBuilder
    private var media: some View {
        let shown = Array(p.media.prefix(4))
        if shown.count == 1, let m = shown.first {
            let ratio = min(1.9, max(0.56, m.ratio ?? (p.platform == "tiktok" ? 9 / 16 : 4 / 5)))
            mediaCell(m, more: 0)
                .aspectRatio(ratio, contentMode: .fit)
                .frame(maxHeight: 420)
                .frame(maxWidth: .infinity)
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)], spacing: 4) {
                ForEach(Array(shown.enumerated()), id: \.offset) { i, m in
                    mediaCell(m, more: i == shown.count - 1 ? p.media.count - shown.count : 0).aspectRatio(1, contentMode: .fit)
                }
            }
        }
    }

    private func mediaCell(_ m: SocialMedia, more: Int) -> some View {
        Color.clear
            .overlay { RemoteImage(m.thumb.isEmpty ? m.url : m.thumb, maxPixel: 900) }
            .overlay {
                if m.isVideo {
                    Image(systemName: "play.fill").font(.system(size: 16, weight: .bold)).foregroundStyle(.white).frame(width: 44, height: 44).glass(in: Circle())
                }
            }
            .overlay {
                if more > 0 { ZStack { Color.black.opacity(0.5); Text("+\(more)").font(.display(28)).foregroundStyle(.white) } }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .onTapGesture {
                if m.isVideo, m.url.hasPrefix("https://") { nav.push(.player(url: m.url, title: p.memberName.isEmpty ? p.platformLabel : p.memberName)) } else if let u = URL(string: p.url) { openURL(u) }
            }
    }
}

/// Video posting sosmed diputar di aplikasi.
struct MediaPlayerScreen: View {
    let url: String
    let title: String
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let u = URL(string: url) { VideoPlayerView(url: u) }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
