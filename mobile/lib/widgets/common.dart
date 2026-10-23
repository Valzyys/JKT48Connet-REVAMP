import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/format.dart';
import '../core/theme.dart';
import 'glass.dart';

/// Logo salib piksel JKT48Connect (grid 5×5, 12 piksel, tengah kosong). `assemble` = piksel terbang lalu tersusun.
class PixelLogo extends StatelessWidget {
  const PixelLogo({super.key, this.size = 28, this.color, this.assemble = false});
  final double size;
  final Color? color;
  final bool assemble;

  static const pixels = [(2, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (3, 2), (4, 2), (1, 3), (2, 3), (3, 3), (2, 4)];

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.of(context).brand;
    final cell = size / 5;
    final rnd = math.Random(48);
    // Arah terbang tiap piksel ditetapkan sekali, supaya tidak bergetar tiap frame.
    final from = [for (final _ in pixels) Offset((rnd.nextDouble() - 0.5) * size * 3, (rnd.nextDouble() - 0.5) * size * 3)];
    return SizedBox.square(
      dimension: size,
      child: Stack(children: [
        for (final (i, (x, y)) in pixels.indexed)
          Positioned(
            left: x * cell,
            top: y * cell,
            child: () {
              final px = Container(
                width: cell * 0.9,
                height: cell * 0.9,
                decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(cell * 0.18)),
              );
              if (!assemble) return px;
              // Dari posisi acak (v = 0) ke posisinya di grid (v = 1).
              return px.animate().custom(
                    duration: 900.ms,
                    delay: (i * 45).ms,
                    curve: Curves.easeOutExpo,
                    builder: (_, v, child) => Transform.translate(
                      offset: from[i] * (1 - v),
                      child: Opacity(opacity: 0.2 + 0.8 * v, child: Transform.scale(scale: 0.4 + 0.6 * v, child: child)),
                    ),
                  );
            }(),
          ),
      ]),
    );
  }
}

/// Empat batang sinyal ala ponsel — motif "Fan Signal".
class SignalBars extends StatefulWidget {
  const SignalBars({super.key, this.color, this.height = 12, this.active = true});
  final Color? color;
  final double height;
  final bool active;
  @override
  State<SignalBars> createState() => _SignalBarsState();
}

class _SignalBarsState extends State<SignalBars> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  @override
  void initState() {
    super.initState();
    if (widget.active) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.color ?? AppColors.of(context).brand;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, _) => Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (var i = 0; i < 4; i++)
          Container(
            margin: const EdgeInsets.only(right: 1.6),
            width: widget.height * 0.22,
            height: widget.height * (0.3 + 0.7 * (i + 1) / 4) * (widget.active ? (0.55 + 0.45 * math.sin((_c.value * 2 * math.pi) + i).abs()) : 1),
            decoration: BoxDecoration(color: c.withValues(alpha: widget.active ? 1 : 0.35), borderRadius: BorderRadius.circular(1)),
          ),
      ]),
    );
  }
}

/// Label mikro (mono, huruf besar, renggang) dengan titik merah opsional.
class Micro extends StatelessWidget {
  const Micro(this.text, {super.key, this.color, this.dot = false});
  final String text;
  final Color? color;
  final bool dot;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (dot) ...[Container(width: 6, height: 6, decoration: BoxDecoration(color: c.brand, shape: BoxShape.circle)), const SizedBox(width: 6)],
      Text(text.toUpperCase(), style: AppText.micro(color: color ?? c.inkSoft)),
    ]);
  }
}

/// Judul bagian: label mikro + judul condensed + tombol "Semua".
class SectionHead extends StatelessWidget {
  const SectionHead({super.key, required this.label, required this.title, this.onMore});
  final String label, title;
  final VoidCallback? onMore;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Micro(label, color: c.brand, dot: true),
            const SizedBox(height: 6),
            Text(title.toUpperCase(), style: AppText.display(30, color: c.ink)),
          ]),
        ),
        if (onMore != null)
          Pressable(
            onTap: onMore,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 7, 9, 7),
              decoration: c.cardDecoration(radius: 99),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text('SEMUA', style: AppText.micro(color: c.ink, size: 10)),
                const SizedBox(width: 4),
                Icon(Icons.north_east_rounded, size: 13, color: c.brand),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// Kepala halaman tab: label mikro + judul besar + elemen kanan opsional (mis. angka).
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.label, required this.title, this.trailing});
  final String label, title;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Micro(label, color: c.brand, dot: true),
            const SizedBox(height: 8),
            Text(title.toUpperCase(), style: AppText.display(44, color: c.ink)),
          ]),
        ),
        ?trailing,
      ]).animate().fadeIn(duration: 380.ms).slideX(begin: -0.04, end: 0, curve: Curves.easeOutCubic),
    );
  }
}

/// Gambar jaringan dengan placeholder berdenyut dan cadangan inisial.
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.alignment = Alignment.topCenter, this.fallback = ''});
  final String url;
  final BoxFit fit;
  final Alignment alignment;
  final String fallback;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    Widget placeholder() => Container(
          color: c.surface,
          alignment: Alignment.center,
          child: fallback.isEmpty ? null : Text(fallback.characters.first.toUpperCase(), style: AppText.display(28, color: c.brand)),
        );
    if (url.isEmpty) return placeholder();
    return Image.network(
      url,
      fit: fit,
      alignment: alignment,
      errorBuilder: (_, _, _) => placeholder(),
      frameBuilder: (_, child, frame, sync) => sync
          ? child
          : AnimatedSwitcher(duration: const Duration(milliseconds: 350), child: frame == null ? Skeleton(key: const ValueKey(0)) : child),
    );
  }
}

/// Kotak abu yang berdenyut selama data dimuat.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height, this.width, this.radius = 18});
  final double? height, width;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        width: width,
        decoration: BoxDecoration(color: AppColors.of(context).surface, borderRadius: BorderRadius.circular(radius)),
      ).animate(onPlay: (c) => c.repeat(reverse: true)).fade(begin: 0.55, end: 1, duration: 900.ms);
}

/// Pil kecil berwarna (kategori jadwal, status).
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, required this.bg, required this.fg});
  final String text;
  final Color bg, fg;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
        child: Text(text.toUpperCase(), style: AppText.micro(color: fg, size: 9.5)),
      );
}

/// Hitung mundur yang berdetak tiap detik.
class Countdown extends StatefulWidget {
  const Countdown(this.iso, {super.key, this.style});
  final String iso;
  final TextStyle? style;
  @override
  State<Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<Countdown> {
  late final Timer _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  @override
  void dispose() {
    _t.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final target = DateTime.tryParse(widget.iso);
    if (target == null) return const SizedBox.shrink();
    return Text(fmtCountdown(target.difference(DateTime.now())), style: widget.style);
  }
}

/// Angka yang menghitung naik saat pertama muncul.
class CountUp extends StatelessWidget {
  const CountUp(this.value, {super.key, this.style});
  final int? value;
  final TextStyle? style;
  @override
  Widget build(BuildContext context) => value == null
      ? Text('–', style: style)
      : TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value!.toDouble()),
          duration: const Duration(milliseconds: 1200),
          curve: Curves.easeOutCubic,
          builder: (_, v, _) => Text(fmtNum(v.round()), style: style),
        );
}

/// Pesan gagal + tombol coba lagi.
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.wifi_tethering_error_rounded, color: c.brand, size: 36),
        const SizedBox(height: 10),
        Text('$error', textAlign: TextAlign.center, style: AppText.body(14, color: c.inkSoft)),
        const SizedBox(height: 12),
        Pressable(
          onTap: onRetry,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
            decoration: BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(99)),
            child: Text('Coba lagi', style: AppText.body(14, color: Colors.white, weight: 800)),
          ),
        ),
      ]),
    );
  }
}

/// Daftar masuk bertahap: tiap anak naik sedikit + memudar, dengan jeda berurutan.
extension StaggerIn on Widget {
  Widget staggerIn(int index, {int step = 50}) =>
      animate().fadeIn(duration: 420.ms, delay: (index.clamp(0, 12) * step).ms).slideY(begin: 0.12, end: 0, curve: Curves.easeOutCubic);
}
