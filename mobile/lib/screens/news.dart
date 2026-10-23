import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/detail_scaffold.dart';
import 'shell.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});
  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  final List<NewsItem> _items = [];
  int _page = 0;
  bool _more = true, _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading || !_more) return;
    setState(() => _loading = true);
    try {
      final p = await Api.instance.news(_page + 1);
      setState(() {
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
    return DetailScaffold(
      title: 'Berita',
      body: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) _load();
          return false;
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, kTopInset, 16, 40),
          children: [
            for (final (i, n) in _items.indexed)
              NewsTile(n, index: i, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => NewsDetailScreen(n)))).staggerIn(i % 10),
            if (_error != null) ErrorRetry(error: _error!, onRetry: _load),
            if (_loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
          ],
        ),
      ),
    );
  }
}

/// Isi berita: HTML dari jkt48.com diubah menjadi paragraf teks biasa; tautan asli bisa dibuka.
class NewsDetailScreen extends StatelessWidget {
  const NewsDetailScreen(this.item, {super.key});
  final NewsItem item;

  static String _text(String html) => html
      .replaceAll(RegExp(r'<(br|/p|/div|/li|/h\d)[^>]*>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return DetailScaffold(
      title: 'Berita',
      actions: [
        if (item.url.isNotEmpty)
          IconButton(tooltip: 'Buka di jkt48.com', onPressed: () => openUrl(item.url), icon: Icon(Icons.open_in_new_rounded, color: c.ink, size: 20)),
      ],
      body: FutureBuilder(
        future: Api.instance.newsDetail(item.id),
        builder: (_, s) => ListView(
          padding: const EdgeInsets.fromLTRB(20, kTopInset, 20, 40),
          children: [
            Micro(item.category, color: c.brand, dot: true).staggerIn(0),
            const SizedBox(height: 10),
            Text(item.title, style: AppText.display(32, color: c.ink)).staggerIn(1),
            const SizedBox(height: 10),
            Text(fmtDate(item.date, pattern: 'EEEE, d MMMM yyyy'), style: AppText.mono(12, color: c.inkSoft)).staggerIn(2),
            const SizedBox(height: 20),
            if (s.hasError) ErrorRetry(error: s.error!, onRetry: () => (context as Element).markNeedsBuild()),
            if (!s.hasData && !s.hasError) ...[for (var i = 0; i < 5; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: Skeleton(height: 16, radius: 6))],
            if (s.hasData) Text(_text(s.data!.content), style: AppText.body(16, color: c.ink, height: 1.65)).staggerIn(3),
          ],
        ),
      ),
    );
  }
}
