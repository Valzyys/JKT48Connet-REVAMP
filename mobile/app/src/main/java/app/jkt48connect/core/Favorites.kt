package app.jkt48connect.core

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.mutableStateMapOf
import org.json.JSONArray
import org.json.JSONObject

/** Member favorit (oshi) yang disimpan di perangkat; dipakai di profil, daftar member, dan beranda. */
object Favorites {
    data class Fav(val id: String, val name: String, val img: String)

    private lateinit var prefs: SharedPreferences
    private val items = mutableStateMapOf<String, Fav>()

    val all: List<Fav> get() = items.values.sortedBy { it.name }

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences("favorites", Context.MODE_PRIVATE)
        val saved = runCatching { JSONArray(prefs.getString("list", "[]")) }.getOrDefault(JSONArray())
        for (i in 0 until saved.length()) saved.optJSONObject(i)?.let { o ->
            val id = o.optString("id")
            if (id.isNotEmpty()) items[id] = Fav(id, o.optString("name"), o.optString("img"))
        }
    }

    fun isFavorite(id: String) = id in items

    fun toggle(id: String, name: String, img: String) {
        if (id in items) items.remove(id) else items[id] = Fav(id, name, img)
        save()
    }

    private fun save() {
        val arr = JSONArray()
        items.values.forEach { arr.put(JSONObject().put("id", it.id).put("name", it.name).put("img", it.img)) }
        prefs.edit().putString("list", arr.toString()).apply()
    }
}
