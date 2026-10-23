package app.jkt48connect

import android.app.Application
import app.jkt48connect.core.Push

/** Firebase disiapkan sedini mungkin supaya pesan push bisa diterima walau aplikasi sedang tertutup. */
class JktApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Push.initCached(this)
    }
}
