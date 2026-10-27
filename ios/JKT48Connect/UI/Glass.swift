import SwiftUI

/**
 Liquid Glass.
 - iOS 26+: kaca asli Apple (`glassEffect`), bisa diberi warna (`tint`) dan interaktif (membal/berkilau saat ditekan).
   Tab bar & bilah navigasi native juga otomatis jadi Liquid Glass karena aplikasi dibangun dengan SDK iOS 26.
 - iOS 16–25: material blur bawaan sistem (`ultraThinMaterial`) dengan tepi terang, supaya tetap terasa seperti kaca.
 */
extension View {
    @ViewBuilder
    func glass<S: Shape>(in shape: S, tint: Color? = nil, interactive: Bool = false) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.glassEffect(Glass.regular.tint(tint).interactive(interactive), in: shape)
        } else {
            fallbackGlass(shape, tint: tint)
        }
        #else
        fallbackGlass(shape, tint: tint)
        #endif
    }

    func glass(tint: Color? = nil, interactive: Bool = false) -> some View {
        glass(in: Capsule(), tint: tint, interactive: interactive)
    }

    func glassCard(_ radius: CGFloat = 24, tint: Color? = nil, interactive: Bool = false) -> some View {
        glass(in: RoundedRectangle(cornerRadius: radius, style: .continuous), tint: tint, interactive: interactive)
    }

    private func fallbackGlass<S: Shape>(_ shape: S, tint: Color?) -> some View {
        self
            .background(tint.map { AnyShapeStyle($0.opacity(0.85)) } ?? AnyShapeStyle(.ultraThinMaterial), in: shape)
            .overlay(shape.stroke(Color.white.opacity(0.28), lineWidth: 0.7))
            .shadow(color: .black.opacity(0.08), radius: 12, y: 6)
    }
}

/// Mengelompokkan beberapa kaca supaya menyatu & berubah bentuk bersama (GlassEffectContainer di iOS 26).
struct GlassGroup<Content: View>: View {
    var spacing: CGFloat = 12
    @ViewBuilder var content: Content

    var body: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// Tombol kaca: iOS 26 memakai gaya tombol kaca sistem; versi lama memakai kapsul material.
struct GlassButton<Label: View>: View {
    var prominent = false
    let action: () -> Void
    @ViewBuilder var label: Label

    var body: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            if prominent {
                Button(action: action) { label }.buttonStyle(.glassProminent)
            } else {
                Button(action: action) { label }.buttonStyle(.glass)
            }
        } else {
            legacy
        }
        #else
        legacy
        #endif
    }

    private var legacy: some View {
        Button(action: action) {
            label
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .foregroundStyle(prominent ? Color.white : Theme.ink)
                .glass(tint: prominent ? Theme.brand : nil)
        }
        .buttonStyle(.plain)
    }
}
