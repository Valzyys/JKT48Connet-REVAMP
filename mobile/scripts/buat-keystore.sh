#!/usr/bin/env bash
# Membuat keystore rilis (sekali saja) lalu mencetak nilai untuk GitHub Secrets workflow Mobile Release.
# Simpan file .jks dan password-nya baik-baik: kalau hilang, update berikutnya harus hapus-pasang aplikasi.
set -euo pipefail
out="${1:-jkt48connect-release.jks}"
alias="jkt48connect"
[ -e "$out" ] && { echo "$out sudah ada, tidak ditimpa." >&2; exit 1; }
read -rsp "Password keystore (min. 6 karakter): " pass; echo
keytool -genkeypair -keystore "$out" -alias "$alias" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$pass" -keypass "$pass" -dname "CN=JKT48Connect, O=JKT48Connect, C=ID" >/dev/null
echo
echo "Keystore dibuat: $out"
echo "Tambahkan di GitHub → Settings → Secrets and variables → Actions → New repository secret:"
echo "  ANDROID_KEYSTORE_BASE64   = (isi file $out.base64 di bawah)"
echo "  ANDROID_KEYSTORE_PASSWORD = password yang baru diketik"
echo "  ANDROID_KEY_ALIAS         = $alias"
echo "  ANDROID_KEY_PASSWORD      = password yang sama"
base64 < "$out" | tr -d '\n' > "$out.base64"
echo "Nilai base64 ditulis ke $out.base64 (hapus file itu setelah disalin)."
