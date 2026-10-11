package com.tempqrmanager.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.tempqrmanager.MainActivity
import com.tempqrmanager.R

class ScanQrCompactWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_scan_qr_compact)

        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            setData(Uri.parse("qrprofile://scan"))
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            202,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_scan_root, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_icon, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_title, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_subtitle, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_arrow_container, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, ScanQrCompactWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (allWidgetIds != null && allWidgetIds.isNotEmpty()) {
                val provider = ScanQrCompactWidgetProvider()
                for (id in allWidgetIds) {
                    provider.updateWidget(context, appWidgetManager, id)
                }
            }
        }
    }
}
