import 'package:intl/intl.dart';

/// Waktu ditampilkan dalam WIB (UTC+7), sama seperti web.
DateTime? parseTime(String iso) {
  final t = DateTime.tryParse(iso);
  return t?.toUtc().add(const Duration(hours: 7));
}

String fmtDate(String iso, {String pattern = 'EEEE, d MMM yyyy'}) {
  final t = parseTime(iso);
  return t == null ? '' : DateFormat(pattern, 'id_ID').format(t);
}

String fmtTime(String iso) {
  final t = parseTime(iso);
  return t == null ? '' : '${DateFormat('HH.mm', 'id_ID').format(t)} WIB';
}

String fmtDuration(int ms) {
  final m = ms ~/ 60000;
  if (m < 60) return '${m}m';
  return '${m ~/ 60}j ${m % 60}m';
}

String fmtNum(int? n) => n == null ? '–' : NumberFormat.decimalPattern('id_ID').format(n);

String fmtCompact(int? n) => n == null ? '–' : NumberFormat.compact(locale: 'id_ID').format(n);

String timeAgo(String iso) {
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'baru saja';
  if (d.inMinutes < 60) return '${d.inMinutes} menit lalu';
  if (d.inHours < 24) return '${d.inHours} jam lalu';
  return '${d.inDays} hari lalu';
}

/// "2 hari 05:41:58" atau "05:41:58".
String fmtCountdown(Duration d) {
  if (d.isNegative) return 'Sedang berlangsung';
  String two(int v) => v.toString().padLeft(2, '0');
  final hms = '${two(d.inHours % 24)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';
  return d.inDays > 0 ? '${d.inDays} hari $hms' : hms;
}
