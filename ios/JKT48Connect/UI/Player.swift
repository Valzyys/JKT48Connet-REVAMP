import AVKit
import SwiftUI

/**
 Pemutar video bawaan iOS (AVPlayerViewController): layar penuh, Picture-in-Picture, AirPlay, kontrol sistem
 (di iOS 26 kontrolnya ikut Liquid Glass). Dipakai untuk live Showroom, replay, dan video YouTube JKT48.

 Live: playlist Showroom hanya ±3 segmen 1 detik, jadi pemutar dibiarkan sedikit di belakang tepi live (≈3 dtk)
 dan tidak mengejar dengan mempercepat putaran — itu yang membuat gambar patah-patah.
 */
struct VideoPlayerView: UIViewControllerRepresentable {
    let url: URL
    var live = false
    var headers: [String: String] = [:]
    var autoplay = true

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        vc.allowsPictureInPicturePlayback = true
        vc.canStartPictureInPictureAutomaticallyFromInline = true
        vc.updatesNowPlayingInfoCenter = true
        vc.videoGravity = .resizeAspect
        context.coordinator.attach(vc, url: url, live: live, headers: headers, autoplay: autoplay)
        return vc
    }

    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) {
        context.coordinator.attach(vc, url: url, live: live, headers: headers, autoplay: autoplay)
    }

    static func dismantleUIViewController(_ vc: AVPlayerViewController, coordinator: Coordinator) {
        // Saat PiP aktif, biarkan tetap berputar di jendela kecil.
        if !coordinator.inPip { vc.player?.pause() }
    }

    final class Coordinator: NSObject, AVPlayerViewControllerDelegate {
        private var current: URL?
        private var stall: NSObjectProtocol?
        var inPip = false

        func attach(_ vc: AVPlayerViewController, url: URL, live: Bool, headers: [String: String], autoplay: Bool) {
            vc.delegate = self
            guard current != url else { return }
            current = url
            var options: [String: Any] = [:]
            if !headers.isEmpty { options["AVURLAssetHTTPHeaderFieldsKey"] = headers }
            let asset = AVURLAsset(url: url, options: options)
            let item = AVPlayerItem(asset: asset)
            if live {
                item.configuredTimeOffsetFromLive = CMTime(seconds: 3, preferredTimescale: 600)
                item.automaticallyPreservesTimeOffsetFromLive = true
                item.preferredForwardBufferDuration = 3
            } else {
                item.preferredForwardBufferDuration = 0
            }
            let player = vc.player ?? AVPlayer()
            player.automaticallyWaitsToMinimizeStalling = true
            player.replaceCurrentItem(with: item)
            vc.player = player
            if let stall { NotificationCenter.default.removeObserver(stall) }
            if live {
                // Setelah tersendat, lanjut lagi begitu buffer cukup (tanpa mengejar tepi live).
                stall = NotificationCenter.default.addObserver(forName: .AVPlayerItemPlaybackStalled, object: item, queue: .main) { [weak player] _ in
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { player?.play() }
                }
            }
            if autoplay { player.play() }
        }

        func playerViewControllerWillStartPictureInPicture(_ playerViewController: AVPlayerViewController) { inPip = true }
        func playerViewControllerDidStopPictureInPicture(_ playerViewController: AVPlayerViewController) { inPip = false }

        deinit { if let stall { NotificationCenter.default.removeObserver(stall) } }
    }
}

/// Bingkai 16:9 hitam untuk pemutar, dengan sudut membulat.
struct PlayerFrame<Content: View>: View {
    var ratio: CGFloat = 16 / 9
    @ViewBuilder var content: Content
    var body: some View {
        ZStack { Color.black; content }
            .aspectRatio(ratio, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
