import SwiftUI
import UIKit

/// Gambar jaringan dengan cache memori + disk (URLCache), diperkecil sesuai ukuran tampil supaya gulir tetap mulus.
final class ImageStore {
    static let shared = ImageStore()
    private let memory = NSCache<NSString, UIImage>()
    private let session: URLSession
    private var running: [String: Task<UIImage?, Never>] = [:]
    private let lock = NSLock()

    private init() {
        memory.totalCostLimit = 80 * 1024 * 1024
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 16 * 1024 * 1024, diskCapacity: 300 * 1024 * 1024)
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.timeoutIntervalForRequest = 25
        session = URLSession(configuration: config)
    }

    func cached(_ url: String) -> UIImage? { memory.object(forKey: url as NSString) }

    func load(_ url: String, maxPixel: CGFloat) async -> UIImage? {
        if let hit = cached(url) { return hit }
        let session = session
        let task: Task<UIImage?, Never> = lock.withLock {
            if let task = running[url] { return task }
            let task = Task<UIImage?, Never> {
                guard let u = URL(string: url), let (data, _) = try? await session.data(from: u) else { return nil }
                return Self.downsample(data, maxPixel: maxPixel)
            }
            running[url] = task
            return task
        }
        let image = await task.value
        lock.withLock { running[url] = nil }
        if let image { memory.setObject(image, forKey: url as NSString, cost: Int(image.size.width * image.size.height * image.scale * image.scale * 4)) }
        return image
    }

    private static func downsample(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return UIImage(data: data) }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: max(64, maxPixel),
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return UIImage(data: data) }
        return UIImage(cgImage: cg)
    }
}

/// Gambar jaringan; bila kosong/gagal tampil inisial nama di atas gradasi merah.
struct RemoteImage: View {
    let url: String
    var fallback: String = ""
    var maxPixel: CGFloat = 900
    var fit = false
    @State private var image: UIImage?

    init(_ url: String, fallback: String = "", maxPixel: CGFloat = 900, fit: Bool = false) {
        self.url = url
        self.fallback = fallback
        self.maxPixel = maxPixel
        self.fit = fit
        _image = State(initialValue: url.isEmpty ? nil : ImageStore.shared.cached(url))
    }

    var body: some View {
        Color.clear
            .overlay {
                if let image {
                    if fit {
                        Image(uiImage: image).resizable().scaledToFit()
                    } else {
                        Image(uiImage: image).resizable().scaledToFill()
                    }
                } else {
                    ZStack {
                        Theme.brandGradient.opacity(fallback.isEmpty ? 0.12 : 0.9)
                        if !fallback.isEmpty {
                            Text(initials).font(.display(22)).foregroundStyle(.white.opacity(0.95))
                        }
                    }
                }
            }
            .clipped()
            .task(id: url) {
                guard !url.isEmpty, image == nil || ImageStore.shared.cached(url) == nil else { return }
                let loaded = await ImageStore.shared.load(url, maxPixel: maxPixel)
                withAnimation(.easeOut(duration: 0.2)) { image = loaded }
            }
    }

    private var initials: String {
        fallback.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}
