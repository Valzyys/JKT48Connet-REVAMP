package app.jkt48connect.stream

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Background reconciliation; payment confirmation runs 24/7 on server. */
class StreamNotifications : JobService() {
    private var job: Job? = null
    override fun onStartJob(params: JobParameters): Boolean {
        StreamApi.init(this)
        job = CoroutineScope(Dispatchers.IO).launch {
            if (StreamApi.token.isNotEmpty()) runCatching { reconcile(this@StreamNotifications) }
            jobFinished(params, false)
        }
        return true
    }
    override fun onStopJob(params: JobParameters): Boolean { job?.cancel(); return true }
    companion object {
        fun schedule(context: Context) {
            val job = JobInfo.Builder(48061, ComponentName(context, StreamNotifications::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15 * 60_000L).build()
            context.getSystemService(JobScheduler::class.java).schedule(job)
        }
        suspend fun reconcile(context: Context) {
            val prefs = context.getSharedPreferences("stream-private", Context.MODE_PRIVATE)
            val last = prefs.getLong("notice_id", 0)
            val items = StreamApi.request("/notices").optJSONArray("items") ?: return
            var newest = last
            for (i in 0 until items.length()) {
                val n = items.getJSONObject(i); val id = n.getLong("id"); newest = maxOf(newest, id)
                if (id > last) StreamApi.notify(id.toInt(), n.getString("title"), n.getString("message"))
            }
            prefs.edit().putLong("notice_id", newest).apply()
        }
    }
}
