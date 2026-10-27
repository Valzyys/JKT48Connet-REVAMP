"""Buat berkas sumber (repo) aplikasi iPhone untuk pemasang di iPhone, tanpa PC.

- repo.json    : format AltStore, juga dibaca SideStore, Feather, dan ESign (field app versi lama ikut diisi).
- scarlet.json : format repo Scarlet (META + daftar aplikasi).

Semua menunjuk URL tetap di prerelease "ios-latest", jadi tautan repo tidak pernah berubah.
Pemakaian: python3 repo.py <versi> <ukuran-byte> <folder-keluaran>
"""

import json
import sys
from datetime import datetime, timezone

BASE = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest"
IPA = f"{BASE}/jkt48connect.ipa"
ICON = f"{BASE}/icon.png"
BUNDLE = "app.jkt48connect.ios"
NAME = "JKT48Connect"
DEV = "Valzyys"
SUBTITLE = "Live, jadwal theater, recent & replay JKT48"
DESC = (
    "Aplikasi fans JKT48: member yang sedang live (Showroom ditonton langsung di aplikasi), jadwal & lineup theater, "
    "recent dengan replay, profil member + favorit, video YouTube JKT48, posting sosmed member, berita, dan ulang tahun. "
    "Tampilan Liquid Glass di iOS 26. Fan-made, tidak berafiliasi dengan JKT48 Operation Team."
)

version, size, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

repo = {
    "name": "JKT48Connect",
    "identifier": "app.jkt48connect.repo",
    "subtitle": SUBTITLE,
    "description": "Sumber resmi aplikasi iPhone JKT48Connect.",
    "iconURL": ICON,
    "website": "https://jkt48connect.app/apps",
    "tintColor": "#E1243A",
    "apps": [
        {
            "name": NAME,
            "bundleIdentifier": BUNDLE,
            "developerName": DEV,
            "subtitle": SUBTITLE,
            "localizedDescription": DESC,
            "iconURL": ICON,
            "tintColor": "#E1243A",
            "category": "entertainment",
            "versions": [
                {
                    "version": version,
                    "date": date,
                    "size": size,
                    "downloadURL": IPA,
                    "localizedDescription": "Versi terbaru dari GitHub.",
                    "minOSVersion": "16.0",
                }
            ],
            # Format lama (ESign, Feather, AltStore lama) membaca field ini langsung di app.
            "version": version,
            "versionDate": date,
            "size": size,
            "downloadURL": IPA,
            "appPermissions": {"entitlements": [], "privacy": {}},
        }
    ],
    "news": [],
}

scarlet = {
    "META": {"repoName": "JKT48Connect", "repoIcon": ICON},
    "Tweaked": [],
    "Other": [
        {
            "name": NAME,
            "version": version,
            "icon": ICON,
            "down": IPA,
            "dev": DEV,
            "category": "Other",
            "description": DESC,
            "bundleID": BUNDLE,
        }
    ],
}

for name, data in (("repo.json", repo), ("scarlet.json", scarlet)):
    with open(f"{out}/{name}", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
