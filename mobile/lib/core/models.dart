// Model data — bentuknya sama dengan hasil normalisasi worker (`src/lib/shape.ts`).

String _s(Object? v) => v is String ? v : '';
int? _n(Object? v) => v is num ? v.toInt() : null;
bool _b(Object? v) => v == true;
List<Map<String, dynamic>> _l(Object? v) => v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];

class Paged<T> {
  Paged(this.items, this.page, this.perpage, this.total);
  final List<T> items;
  final int page, perpage, total;
  bool get hasMore => page * perpage < total;

  static Paged<T> parse<T>(Map<String, dynamic> j, T Function(Map<String, dynamic>) map) =>
      Paged(_l(j['items']).map(map).toList(), _n(j['page']) ?? 1, _n(j['perpage']) ?? 12, _n(j['total']) ?? 0);
}

class Member {
  Member(this.id, this.name, this.nickname, this.img, this.isGraduate);
  final String id, name, nickname, img;
  final bool isGraduate;
  String get shortName => nickname.isNotEmpty ? nickname : name.split(' ').first;

  factory Member.fromJson(Map<String, dynamic> j) =>
      Member(_s(j['id']), _s(j['name']), _s(j['nickname']), _s(j['img']), _b(j['isGraduate']));
}

class MemberDetail extends Member {
  MemberDetail(Member m, this.fullname, this.birthdate, this.bloodType, this.height, this.description, this.jikosokai, this.socials,
      this.upcomingShows, this.totalShowroom, this.totalIdn)
      : super(m.id, m.name, m.nickname, m.img, m.isGraduate);
  final String fullname, birthdate, bloodType, height, description, jikosokai;
  final List<({String title, String url})> socials;
  final List<TheaterShow> upcomingShows;
  final int? totalShowroom, totalIdn;

  factory MemberDetail.fromJson(Map<String, dynamic> j) {
    final total = j['totalLive'] is Map ? j['totalLive'] as Map : null;
    return MemberDetail(
      Member.fromJson(j),
      _s(j['fullname']),
      _s(j['birthdate']),
      _s(j['bloodType']),
      _s(j['height']),
      _s(j['description']),
      _s(j['jikosokai']),
      _l(j['socials']).map((s) => (title: _s(s['title']), url: _s(s['url']))).where((s) => s.url.isNotEmpty).toList(),
      _l(j['upcomingShows']).map(TheaterShow.fromJson).toList(),
      _n(total?['showroom']),
      _n(total?['idn']),
    );
  }
}

class LiveSession {
  LiveSession(this.id, this.name, this.fullname, this.img, this.avatar, this.platform, this.startedAt, this.title, this.link, this.banner);
  final String id, name, fullname, img, avatar, platform, startedAt, title, link, banner;
  String get platformLabel => platform == 'idn' ? 'IDN Live' : platform == 'showroom' ? 'Showroom' : platform;

  factory LiveSession.fromJson(Map<String, dynamic> j) => LiveSession(_s(j['id']), _s(j['name']), _s(j['fullname']), _s(j['img']),
      _s(j['avatar']), _s(j['platform']), _s(j['startedAt']), _s(j['title']), _s(j['link']), _s(j['banner']));
}

class ShowMember {
  ShowMember(this.id, this.name, this.img);
  final String id, name, img;
  factory ShowMember.fromJson(Map<String, dynamic> j) => ShowMember(_s(j['id']), _s(j['name']), _s(j['img']));
}

class TheaterShow {
  TheaterShow(this.id, this.title, this.date, this.team, this.category, this.banner, this.poster, this.memberCount, this.members, this.birthday);
  final String id, title, date, team, category, banner, poster;
  final int? memberCount;
  final List<ShowMember> members, birthday;

  factory TheaterShow.fromJson(Map<String, dynamic> j) => TheaterShow(
        _s(j['id']),
        _s(j['title']),
        _s(j['date']),
        _s(j['team']),
        _s(j['category']),
        _s(j['banner']),
        _s(j['poster']),
        _n(j['memberCount']),
        _l(j['members']).map(ShowMember.fromJson).toList(),
        _l(j['birthday']).map(ShowMember.fromJson).toList(),
      );
}

class TheaterDetail extends TheaterShow {
  TheaterDetail(TheaterShow s, this.songs)
      : super(s.id, s.title, s.date, s.team, s.category, s.banner, s.poster, s.memberCount, s.members, s.birthday);
  final List<String> songs;
  factory TheaterDetail.fromJson(Map<String, dynamic> j) =>
      TheaterDetail(TheaterShow.fromJson(j), (j['songs'] is List ? (j['songs'] as List).whereType<String>().toList() : <String>[]));
}

class NewsItem {
  NewsItem(this.id, this.title, this.date, this.category, this.url, [this.content = '']);
  final String id, title, date, category, url, content;
  factory NewsItem.fromJson(Map<String, dynamic> j) =>
      NewsItem(_s(j['id']), _s(j['title']), _s(j['date']), _s(j['category']), _s(j['url']), _s(j['content']));
}

class BirthdayEntry {
  BirthdayEntry(this.id, this.name, this.img, this.birthdate);
  final String id, name, img, birthdate;
  factory BirthdayEntry.fromJson(Map<String, dynamic> j) => BirthdayEntry(_s(j['id']), _s(j['name']), _s(j['img']), _s(j['birthdate']));
}

class RecentLive {
  RecentLive(this.id, this.name, this.memberId, this.img, this.platform, this.start, this.end, this.durationMs, this.viewers, this.points,
      this.pointUnit, this.title);
  final String id, name, memberId, img, platform, start, end, pointUnit, title;
  final int durationMs;
  final int? viewers, points;
  String get platformLabel => platform == 'idn' ? 'IDN Live' : platform == 'showroom' ? 'Showroom' : platform;
  String get pointLabel => pointUnit.contains('gold') ? 'Gold' : 'Poin';

  factory RecentLive.fromJson(Map<String, dynamic> j) => RecentLive(_s(j['id']), _s(j['name']), _s(j['memberId']), _s(j['img']),
      _s(j['platform']), _s(j['start']), _s(j['end']), _n(j['durationMs']) ?? 0, _n(j['viewers']), _n(j['points']), _s(j['pointUnit']),
      _s(j['title']));
}

class Recording {
  Recording(this.url, this.hls, this.durationMs, this.partial);
  final String url;
  final String? hls;
  final int durationMs;
  final bool partial;
  factory Recording.fromJson(Map<String, dynamic> j) =>
      Recording(_s(j['url']), j['hls'] is String ? j['hls'] as String : null, _n(j['durationMs']) ?? 0, _b(j['partial']));
}

class RecentDetail extends RecentLive {
  RecentDetail(RecentLive r, this.gifts, this.fans, this.comments, this.recordings, this.recordingCount, this.replayUnlockAt, this.screenshots)
      : super(r.id, r.name, r.memberId, r.img, r.platform, r.start, r.end, r.durationMs, r.viewers, r.points, r.pointUnit, r.title);
  final List<({String name, String img, int? num})> gifts;
  final List<({String name, String avatar, int? amount})> fans;
  final int? comments;
  final List<Recording> recordings;
  final int recordingCount;
  final String replayUnlockAt;
  final List<({String url, String at})> screenshots;

  factory RecentDetail.fromJson(Map<String, dynamic> j) => RecentDetail(
        RecentLive.fromJson(j),
        _l(j['gifts']).map((g) => (name: _s(g['name']), img: _s(g['img']), num: _n(g['num']))).toList(),
        _l(j['fans']).map((f) => (name: _s(f['name']), avatar: _s(f['avatar']), amount: _n(f['amount']))).toList(),
        _n(j['comments']),
        _l(j['recordings']).map(Recording.fromJson).toList(),
        _n(j['recordingCount']) ?? 0,
        _s(j['replayUnlockAt']),
        _l(j['screenshots']).map((s) => (url: _s(s['url']), at: _s(s['at']))).where((s) => s.url.isNotEmpty).toList(),
      );
}
