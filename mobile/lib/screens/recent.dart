import 'dart:async';

import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';
import 'package:video_player/video_player.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/detail_scaffold.dart';
import '../widgets/glass.dart';
import 'shell.dart';

/// Daftar rekap live dengan muat-lanjut saat menggulir.
class RecentScreen extends StatefulWidget {
  const RecentScreen({super.key});
  @override
  State<RecentScreen> createState() => _RecentScreenState();
}

class _RecentScreenState extends State<RecentScreen> {
  final List<RecentLive> _items = [];
  int _page = 0;
  bool _more = true, _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading || (!_more && !reset)) return;
    setState(() => _loading = true);
    try {
      final p = await Api.instance.recent(reset ? 1 : _page + 1, force: reset);
      setState(() {
        if (reset) _items.clear();
        _items.addAll(p.items);
        _page = p.page;
        _more = p.hasMore;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.pixels > n.metrics.maxScrollExtent - 500) _load();
        return false;
      },
      child: RefreshIndicator(
        color: c.brand,
        edgeOffset: kTopInset,
        onRefresh: () => _load(reset: true),
        child: ListView(
          padding: const EdgeInsets.only(top: kTopInset, bottom: kBottomInset),
          children: [
            const PageHeader(label: 'Gift · supporter · replay', title: 'Recent'),
            if (_items.isEmpty && _loading)
              for (var i = 0; i < 5; i++) const Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 10), child: Skeleton(height: 94)),
            for (final (i, r) in _items.indexed)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: RecentTile(r, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RecentDetailScreen(r)))).staggerIn(i % 12),
              ),
            if (_error != null) ErrorRetry(error: _error!, onRetry: _load),
            if (_loading && _items.isNotEmpty) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
          ],
        ),
      ),
    );
  }
}

/// Detail rekap: foto, statistik, replay (terkunci 72 jam), supporter, gift, dan cuplikan layar.
class RecentDetailScreen extends StatefulWidget {
  const RecentDetailScreen(this.item, {super.key});
  final RecentLive item;
  @override
  State<RecentDetailScreen> createState() => _RecentDetailScreenState();
}

class _RecentDetailScreenState extends State<RecentDetailScreen> {
  late Future<RecentDetail> _f = Api.instance.recentDetail(widget.item.id);

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final r = widget.item;
    return DetailScaffold(
      title: r.name,
      body: FutureBuilder(
        future: _f,
        builder: (_, s) {
          final d = s.data;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, kTopInset, 16, 40),
            children: [
              Row(children: [
                ClipRRect(borderRadius: BorderRadius.circular(20), child: SizedBox(width: 84, height: 100, child: NetImage(r.img, fallback: r.name))),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Micro(r.platformLabel, color: c.brand, dot: true),
                    const SizedBox(height: 6),
                    Text(r.name.toUpperCase(), style: AppText.display(32, color: c.ink)),
                    const SizedBox(height: 4),
                    Text('${fmtDate(r.start, pattern: 'EEEE, d MMM yyyy')} · ${fmtTime(r.start)}', style: AppText.mono(11.5, color: c.inkSoft)),
                  ]),
                ),
              ]).staggerIn(0),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.1,
                children: [
                  _StatBox('Durasi', Text(fmtDuration(r.durationMs), style: AppText.display(30, color: Colors.white)), accent: true),
                  _StatBox('Penonton', CountUp(r.viewers, style: AppText.display(30, color: c.ink))),
                  _StatBox(r.pointLabel, CountUp(r.points, style: AppText.display(30, color: c.ink))),
                  _StatBox('Komentar', CountUp(d?.comments, style: AppText.display(30, color: c.ink))),
                ].indexed.map((e) => e.$2.staggerIn(e.$1 + 1)).toList(),
              ),
              const SizedBox(height: 18),
              if (s.hasError) ErrorRetry(error: s.error!, onRetry: () => setState(() => _f = Api.instance.recentDetail(r.id, force: true))),
              if (!s.hasData && !s.hasError) const Skeleton(height: 220, radius: 26),
              if (d != null) ...[
                _ReplayPanel(d, onUnlock: () => setState(() => _f = Api.instance.recentDetail(r.id, force: true))).staggerIn(5),
                if (d.fans.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  Micro('Top supporter', color: c.brand, dot: true),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: c.cardDecoration(radius: 24),
                    child: Column(children: [
                      for (final (i, f) in d.fans.take(10).indexed)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: c.line, width: 0.8))),
                          child: Row(children: [
                            Container(
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(gradient: i < 3 ? c.brandGradient : null, shape: BoxShape.circle),
                              child: Text('${i + 1}', style: AppText.mono(11.5, color: i < 3 ? Colors.white : c.inkSoft, weight: FontWeight.w600)),
                            ),
                            const SizedBox(width: 10),
                            ClipOval(child: SizedBox(width: 34, height: 34, child: NetImage(f.avatar, fallback: f.name))),
                            const SizedBox(width: 10),
                            Expanded(child: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(14, color: c.ink, weight: 700))),
                            Text(fmtNum(f.amount), style: AppText.mono(12.5, color: i < 3 ? c.brand : c.ink, weight: FontWeight.w600)),
                          ]),
                        ).staggerIn(i, step: 30),
                    ]),
                  ),
                ],
                if (d.gifts.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  Micro('Gift', color: c.brand, dot: true),
                  const SizedBox(height: 10),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final g in d.gifts.take(18))
                      Container(
                        padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                        decoration: c.cardDecoration(radius: 99),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          SizedBox(width: 26, height: 26, child: g.img.isEmpty ? Icon(Icons.redeem_rounded, color: c.brand, size: 18) : NetImage(g.img, fit: BoxFit.contain, alignment: Alignment.center)),
                          const SizedBox(width: 6),
                          Text('${g.name} ×${fmtNum(g.num)}', style: AppText.body(12.5, color: c.ink, weight: 700)),
                        ]),
                      ),
                  ]),
                ],
                if (d.screenshots.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  Micro('Cuplikan · ${d.screenshots.length}', color: c.brand, dot: true),
                  const SizedBox(height: 10),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 6, crossAxisSpacing: 6, childAspectRatio: 0.75),
                    itemCount: d.screenshots.length.clamp(0, 30),
                    itemBuilder: (_, i) => GestureDetector(
                      onTap: () => _openShots(context, d, i),
                      child: ClipRRect(borderRadius: BorderRadius.circular(14), child: NetImage(d.screenshots[i].url, alignment: Alignment.center)),
                    ).staggerIn(i % 12, step: 25),
                  ),
                ],
              ],
            ],
          );
        },
      ),
    );
  }

  void _openShots(BuildContext context, RecentDetail d, int start) => Navigator.of(context).push(PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (_, _, _) => _ShotViewer(d.screenshots.map((s) => s.url).toList(), start),
        transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
      ));
}

class _StatBox extends StatelessWidget {
  const _StatBox(this.label, this.value, {this.accent = false});
  final String label;
  final Widget value;
  final bool accent;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: accent ? BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(22)) : c.cardDecoration(radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(label.toUpperCase(), style: AppText.micro(color: accent ? Colors.white70 : c.inkSoft, size: 9.5)),
        const SizedBox(height: 4),
        value,
      ]),
    );
  }
}

/// Replay: terkunci dengan hitung mundur sampai 72 jam setelah live, lalu berubah jadi pemutar.
class _ReplayPanel extends StatefulWidget {
  const _ReplayPanel(this.d, {required this.onUnlock});
  final RecentDetail d;
  final VoidCallback onUnlock;
  @override
  State<_ReplayPanel> createState() => _ReplayPanelState();
}

class _ReplayPanelState extends State<_ReplayPanel> {
  int _part = 0;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final d = widget.d;
    if (d.recordingCount == 0) return const SizedBox.shrink();
    if (d.recordings.isEmpty) {
      final unlock = DateTime.tryParse(d.replayUnlockAt);
      final start = DateTime.tryParse(d.end.isNotEmpty ? d.end : d.start);
      final progress = unlock == null || start == null
          ? 0.0
          : (DateTime.now().difference(start).inSeconds / unlock.difference(start).inSeconds).clamp(0.0, 1.0);
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: c.panelDecoration(radius: 28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(15)),
              child: const Icon(Icons.lock_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(child: Text('REPLAY · TERBUKA 72 JAM SETELAH LIVE', style: AppText.micro(color: Colors.white54))),
          ]),
          const SizedBox(height: 14),
          if (unlock != null) Countdown(d.replayUnlockAt, style: AppText.display(34, color: Colors.white)),
          if (unlock != null && DateTime.now().isAfter(unlock))
            TextButton(onPressed: widget.onUnlock, child: Text('Muat replay', style: AppText.body(14, color: c.brand, weight: 800))),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 1400),
              curve: Curves.easeOutCubic,
              builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 6, backgroundColor: Colors.white12, color: c.brand),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Text('Live selesai', style: AppText.mono(10.5, color: Colors.white38)),
            const Spacer(),
            Text('${(progress * 100).round()}%', style: AppText.mono(10.5, color: Colors.white70)),
            const Spacer(),
            Text('Replay terbuka', style: AppText.mono(10.5, color: Colors.white38)),
          ]),
        ]),
      );
    }
    final rec = d.recordings[_part.clamp(0, d.recordings.length - 1)];
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: c.panelDecoration(radius: 28),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 10),
          child: Row(children: [
            Icon(Icons.play_arrow_rounded, color: c.brand, size: 18),
            const SizedBox(width: 4),
            Text('REPLAY', style: AppText.micro(color: Colors.white60)),
            const Spacer(),
            if (d.recordings.length > 1)
              for (var i = 0; i < d.recordings.length; i++)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: ChoiceChip(
                    label: Text('Bagian ${i + 1}'),
                    selected: i == _part,
                    onSelected: (_) => setState(() => _part = i),
                    selectedColor: c.brand,
                    labelStyle: AppText.body(11, color: Colors.white, weight: 700),
                    backgroundColor: Colors.white10,
                    side: BorderSide.none,
                    showCheckmark: false,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
          ]),
        ),
        ReplayPlayer(key: ValueKey(rec.url), rec: rec, portrait: d.platform == 'idn'),
      ]),
    );
  }
}

/// Pemutar replay: memakai playlist HLS (mulai & seek cepat) bila ada, cadangan MP4. Token aplikasi ikut di header.
class ReplayPlayer extends StatefulWidget {
  const ReplayPlayer({super.key, required this.rec, this.portrait = false});
  final Recording rec;
  final bool portrait;
  @override
  State<ReplayPlayer> createState() => _ReplayPlayerState();
}

class _ReplayPlayerState extends State<ReplayPlayer> {
  VideoPlayerController? _v;
  Object? _error;
  bool _controls = true;
  bool _usedHls = false;
  double? _drag;
  Timer? _hide;

  @override
  void initState() {
    super.initState();
    _init(preferHls: widget.rec.hls != null);
  }

  Future<void> _init({required bool preferHls}) async {
    final api = Api.instance;
    final url = api.absolute(preferHls ? widget.rec.hls! : widget.rec.url);
    final v = VideoPlayerController.networkUrl(
      Uri.parse(url),
      httpHeaders: await api.authHeaders(),
      formatHint: preferHls ? VideoFormat.hls : null,
    );
    _usedHls = preferHls;
    try {
      await v.initialize();
      v.addListener(() {
        if (mounted) setState(() {});
      });
      setState(() => _v = v);
    } catch (e) {
      await v.dispose();
      if (preferHls) return _init(preferHls: false); // HLS gagal → MP4 biasa
      setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    _hide?.cancel();
    _v?.dispose();
    super.dispose();
  }

  void _toggle() {
    final v = _v;
    if (v == null) return;
    v.value.isPlaying ? v.pause() : v.play();
    _wake();
  }

  void _wake() {
    setState(() => _controls = true);
    _hide?.cancel();
    _hide = Timer(const Duration(seconds: 3), () {
      if (mounted && (_v?.value.isPlaying ?? false)) setState(() => _controls = false);
    });
  }

  String _t(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}' : '${two(d.inMinutes)}:${two(d.inSeconds % 60)}';
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final v = _v;
    final ratio = v != null && v.value.isInitialized ? v.value.aspectRatio : (widget.portrait ? 9 / 16 : 16 / 9);
    final maxH = MediaQuery.sizeOf(context).height * 0.62;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxH),
        child: AspectRatio(
          aspectRatio: ratio,
          child: Container(
            color: Colors.black,
            child: _error != null
                ? Center(child: Text('Replay belum bisa diputar.\n$_error', textAlign: TextAlign.center, style: AppText.body(13, color: Colors.white70)))
                : v == null
                    ? const Center(child: CircularProgressIndicator(color: Colors.white))
                    : GestureDetector(
                        onTap: _wake,
                        onDoubleTapDown: (e) {
                          final box = context.size?.width ?? 1;
                          final back = e.localPosition.dx < box / 2;
                          v.seekTo(v.value.position + Duration(seconds: back ? -10 : 10));
                          _wake();
                        },
                        child: Stack(fit: StackFit.expand, children: [
                          VideoPlayer(v),
                          if (v.value.isBuffering) const Center(child: CircularProgressIndicator(color: Colors.white)),
                          AnimatedOpacity(
                            opacity: _controls || !v.value.isPlaying ? 1 : 0,
                            duration: const Duration(milliseconds: 250),
                            child: IgnorePointer(
                              ignoring: !(_controls || !v.value.isPlaying),
                              child: Stack(children: [
                                const Positioned.fill(
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xAA000000)], stops: [0.5, 1])),
                                  ),
                                ),
                                Center(
                                  child: GlassChip(
                                    dark: true,
                                    radius: 37,
                                    onTap: _toggle,
                                    padding: const EdgeInsets.all(18),
                                    child: Icon(v.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, color: Colors.white, size: 38),
                                  ),
                                ),
                                Positioned(
                                  left: 12,
                                  right: 12,
                                  bottom: 10,
                                  child: Row(children: [
                                    Text(_t(v.value.position), style: AppText.mono(11, color: Colors.white)),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: LayoutBuilder(
                                        builder: (_, box) => LiquidGlassSlider(
                                          width: box.maxWidth,
                                          height: 30,
                                          value: _drag ?? _ratio(v),
                                          activeColor: c.brand,
                                          inactiveColor: Colors.white24,
                                          onChangeStart: (_) => _hide?.cancel(),
                                          onChanged: (x) => setState(() => _drag = x),
                                          onChangeEnd: (x) {
                                            v.seekTo(v.value.duration * x);
                                            setState(() => _drag = null);
                                            _wake();
                                          },
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(_t(v.value.duration), style: AppText.mono(11, color: Colors.white70)),
                                  ]),
                                ),
                                if (_usedHls)
                                  Positioned(top: 10, right: 12, child: Text('HLS', style: AppText.micro(color: Colors.white38, size: 9))),
                              ]),
                            ),
                          ),
                        ]),
                      ),
          ),
        ),
      ),
    );
  }

  double _ratio(VideoPlayerController v) {
    final total = v.value.duration.inMilliseconds;
    return total == 0 ? 0 : (v.value.position.inMilliseconds / total).clamp(0.0, 1.0);
  }
}

/// Penampil cuplikan layar: geser kiri/kanan.
class _ShotViewer extends StatelessWidget {
  const _ShotViewer(this.urls, this.start);
  final List<String> urls;
  final int start;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(children: [
        PageView.builder(
          controller: PageController(initialPage: start),
          itemCount: urls.length,
          itemBuilder: (_, i) => InteractiveViewer(child: Center(child: NetImage(urls[i], fit: BoxFit.contain, alignment: Alignment.center))),
        ),
        Positioned(
          top: MediaQuery.paddingOf(context).top + 10,
          right: 16,
          child: GlassChip(dark: true, radius: 22, onTap: () => Navigator.of(context).pop(), padding: const EdgeInsets.all(10), child: const Icon(Icons.close_rounded, color: Colors.white)),
        ),
      ]),
    );
  }
}
