package com.tempqrmanager.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import com.tempqrmanager.MainActivity
import com.tempqrmanager.R

class ScanQrWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
            val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
            updateWidget(context, appWidgetManager, appWidgetId, minWidth, minHeight)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?
    ) {
        val minHeight = newOptions?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
        val minWidth = newOptions?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
        updateWidget(context, appWidgetManager, appWidgetId, minWidth, minHeight)
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        minWidth: Int,
        minHeight: Int
    ) {
        val layoutId = when {
            minWidth in 1..100 && minHeight in 1..100 -> R.layout.widget_scan_qr_small
            minHeight in 1..90 -> R.layout.widget_scan_qr_compact
            else -> R.layout.widget_scan_qr
        }

        val views = RemoteViews(context.packageName, layoutId)

        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            setData(Uri.parse("qrprofile://scan"))
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            201,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_scan_root, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_icon, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_scan_title, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, ScanQrWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (allWidgetIds != null && allWidgetIds.isNotEmpty()) {
                val provider = ScanQrWidgetProvider()
                for (id in allWidgetIds) {
                    val options = appWidgetManager.getAppWidgetOptions(id)
                    val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0
                    val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
                    provider.updateWidget(context, appWidgetManager, id, minWidth, minHeight)
                }
            }
        }
    }
}
