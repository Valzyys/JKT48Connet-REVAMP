import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Alamat situs JKT48Connect (worker yang sama dengan web). Atur saat build:
///   flutter build apk --dart-define=API_BASE=https://domain-kamu
/// Di web build dipakai alamat relatif (situs yang sama).
const String _base = String.fromEnvironment('API_BASE', defaultValue: 'https://jkt48connect.app');

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// Klien `/api/app/*`: token aplikasi (Bearer) diminta otomatis, disimpan, dan diperbarui saat kedaluwarsa.
/// Respons disimpan sebentar di memori supaya pindah tab tidak memuat ulang.
class Api {
  Api._();
  static final Api instance = Api._();

  static String get base => kIsWeb ? '' : _base;

  final http.Client _http = http.Client();
  String? _token;
  Future<String>? _issuing;
  final Map<String, ({DateTime at, Object data})> _cache = {};

  /// Header untuk pemutar video (replay) — token yang sama dengan data.
  Future<Map<String, String>> authHeaders() async => {'Authorization': 'Bearer ${await _ensureToken()}'};

  String absolute(String path) => path.startsWith('http') ? path : '$base$path';

  Future<String> _ensureToken() async {
    if (_token != null) return _token!;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('app_token');
    final exp = prefs.getInt('app_token_exp') ?? 0;
    if (saved != null && exp > DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600) return _token = saved;
    return _issuing ??= _issue().whenComplete(() => _issuing = null);
  }

  Future<String> _issue() async {
    final res = await _http.post(Uri.parse('$base/api/app/session'), headers: {'Content-Type': 'application/json'}, body: '{}');
    final body = _decode(res);
    final token = body['token'] as String;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('app_token', token);
    await prefs.setInt('app_token_exp', (body['exp'] as num).toInt());
    return _token = token;
  }

  Map<String, dynamic> _decode(http.Response res) {
    Object? body;
    try {
      body = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {}
    if (res.statusCode >= 400) {
      final msg = body is Map && body['message'] is String ? body['message'] as String : 'Gagal memuat data (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return body is Map<String, dynamic> ? body : {'list': body};
  }

  Future<Object?> _get(String path, {Duration ttl = const Duration(minutes: 1), bool force = false}) async {
    final hit = _cache[path];
    if (!force && hit != null && DateTime.now().difference(hit.at) < ttl) return hit.data;
    Future<http.Response> send() async =>
        _http.get(Uri.parse('$base/api/app$path'), headers: {'Authorization': 'Bearer ${await _ensureToken()}'});
    var res = await send();
    if (res.statusCode == 401) {
      // Token kedaluwarsa/diganti server → minta baru sekali, lalu ulangi.
      _token = null;
      (await SharedPreferences.getInstance()).remove('app_token');
      res = await send();
    }
    final decoded = _decode(res);
    final data = decoded.containsKey('list') && decoded.length == 1 ? decoded['list'] : decoded;
    _cache[path] = (at: DateTime.now(), data: data!);
    return data;
  }

  List<Map<String, dynamic>> _list(Object? v) => v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];

  Future<List<LiveSession>> live({bool force = false}) async =>
      _list(await _get('/now_live', ttl: const Duration(seconds: 20), force: force)).map(LiveSession.fromJson).toList();
  Future<List<Member>> members({bool force = false}) async =>
      _list(await _get('/member', ttl: const Duration(minutes: 30), force: force)).map(Member.fromJson).toList();
  Future<MemberDetail> member(String id) async => MemberDetail.fromJson(await _get('/member/${Uri.encodeComponent(id)}') as Map<String, dynamic>);
  Future<List<TheaterShow>> nextSchedule({bool force = false}) async =>
      _list(await _get('/next_schedule', ttl: const Duration(minutes: 5), force: force)).map(TheaterShow.fromJson).toList();
  Future<Paged<TheaterShow>> theater(int page, {bool force = false}) async =>
      Paged.parse(await _get('/theater?page=$page&perpage=12', force: force) as Map<String, dynamic>, TheaterShow.fromJson);
  Future<TheaterDetail> theaterDetail(String id) async =>
      TheaterDetail.fromJson(await _get('/theater/${Uri.encodeComponent(id)}') as Map<String, dynamic>);
  Future<Paged<RecentLive>> recent(int page, {bool force = false}) async =>
      Paged.parse(await _get('/recent?page=$page&perpage=12', force: force) as Map<String, dynamic>, RecentLive.fromJson);
  Future<RecentDetail> recentDetail(String id, {bool force = false}) async =>
      RecentDetail.fromJson(await _get('/recent/${Uri.encodeComponent(id)}', force: force) as Map<String, dynamic>);
  Future<Paged<NewsItem>> news(int page, {bool force = false}) async =>
      Paged.parse(await _get('/news?page=$page&perpage=10', force: force) as Map<String, dynamic>, NewsItem.fromJson);
  Future<NewsItem> newsDetail(String id) async => NewsItem.fromJson(await _get('/news/${Uri.encodeComponent(id)}') as Map<String, dynamic>);
  Future<List<BirthdayEntry>> birthdays({bool force = false}) async =>
      _list(await _get('/next_birthday', ttl: const Duration(hours: 1), force: force)).map(BirthdayEntry.fromJson).toList();
}
