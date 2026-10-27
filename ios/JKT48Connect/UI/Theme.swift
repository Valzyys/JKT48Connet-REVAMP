import SwiftUI
import UIKit

/// Palet sama dengan aplikasi Android (gaya iOS: abu sistem + merah JKT48Connect).
enum Theme {
    static let brand = Color("AccentColor")
    static let brandGradient = LinearGradient(colors: [Color(red: 1, green: 0.29, blue: 0.37), Color(red: 0.76, green: 0.08, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)
    static let bg = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let ink = Color(uiColor: .label)
    static let inkSoft = Color(uiColor: .secondaryLabel)
    static let line = Color(uiColor: .separator)
    static let butter = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.18, green: 0.14, blue: 0.06, alpha: 1) : UIColor(red: 1, green: 0.94, blue: 0.78, alpha: 1) })
    static let butterInk = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 1, green: 0.79, blue: 0.36, alpha: 1) : UIColor(red: 0.54, green: 0.35, blue: 0, alpha: 1) })
}

extension Font {
    /// Judul tebal rapat, seperti "LIVE SEKARANG" di aplikasi Android.
    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .black).width(.condensed) }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font { .system(size: size, weight: weight, design: .monospaced) }
}

/// Label kecil huruf kapital berjarak (mono), mis. "IDN LIVE · SHOWROOM".
struct Micro: View {
    let text: String
    var color: Color = Theme.inkSoft
    var size: CGFloat = 10.5
    init(_ text: String, color: Color = Theme.inkSoft, size: CGFloat = 10.5) {
        self.text = text
        self.color = color
        self.size = size
    }
    var body: some View {
        Text(text.uppercased()).font(.mono(size, .semibold)).tracking(1.4).foregroundStyle(color).lineLimit(1)
    }
}

/// Latar ambient: gumpalan warna lembut (statis) di belakang isi, supaya kaca di atasnya punya sesuatu untuk dibiaskan.
struct Ambient: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack {
            Theme.bg
            Circle().fill(Theme.brand.opacity(scheme == .dark ? 0.35 : 0.22)).frame(width: 420).blur(radius: 90).offset(x: -140, y: -320)
            Circle().fill(Color.pink.opacity(scheme == .dark ? 0.22 : 0.18)).frame(width: 360).blur(radius: 100).offset(x: 170, y: -120)
            Circle().fill(Color.orange.opacity(scheme == .dark ? 0.12 : 0.12)).frame(width: 320).blur(radius: 110).offset(x: -60, y: 380)
        }
        .ignoresSafeArea()
    }
}
