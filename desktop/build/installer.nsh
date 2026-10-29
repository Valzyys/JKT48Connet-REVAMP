; Teks & warna installer JKT48Connect (dimuat electron-builder lewat nsis.include, sebelum halaman MUI dibuat).

; Latar halaman sambutan/selesai & header memakai kertas krem brand, teks tinta gelap.
!define MUI_BGCOLOR "F3EEE6"
!define MUI_TEXTCOLOR "1D1517"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Selamat datang di JKT48Connect"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Live member, jadwal theater, recent, replay, dan notifikasi live JKT48, sekarang di Windows.$\r$\n$\r$\nInstaller ini akan memasang JKT48Connect di komputermu. Tidak perlu akun, dan aplikasi memperbarui dirinya sendiri secara otomatis.$\r$\n$\r$\nKlik Berikutnya untuk mulai."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "JKT48Connect siap!"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "JKT48Connect sudah terpasang. Pintasannya ada di Desktop dan Start Menu.$\r$\n$\r$\nTips: aktifkan notifikasi live di aplikasi supaya tidak ketinggalan saat oshi mulai live."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Buka JKT48Connect sekarang"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_LINK "Panduan & aplikasi Android/iPhone: jkt48connect.app/apps"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://jkt48connect.app/apps"
  !insertmacro MUI_PAGE_FINISH
!macroend
