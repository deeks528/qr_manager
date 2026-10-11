package com.tempqrmanager.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.tempqrmanager.MainActivity
import com.tempqrmanager.R

class DefaultProfileWideWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val data = WidgetDataManager.loadDefaultProfile(context)

        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, data)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        data: WidgetProfileData
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_default_profile_wide)

        if (data.hasDefault && data.nickname.isNotEmpty()) {
            val avatarBitmap = WidgetDataManager.createAvatarBitmap(
                initials = if (data.initials.isNotEmpty()) data.initials else "UP",
                colorHex = data.avatarColor,
                sizeDp = 44,
                context = context
            )
            views.setImageViewBitmap(R.id.widget_default_avatar, avatarBitmap)
            views.setTextViewText(R.id.widget_default_title, data.nickname)
            views.setTextViewText(
                R.id.widget_default_subtitle,
                if (data.subtitle.isNotEmpty()) data.subtitle else data.nickname
            )

            val qrBitmap = WidgetDataManager.createQrBitmap(
                payload = data.qrPayload,
                imagePath = data.imagePath,
                sizeDp = 120,
                context = context
            )

            if (qrBitmap != null) {
                views.setImageViewBitmap(R.id.widget_default_qr, qrBitmap)
                views.setViewVisibility(R.id.widget_default_qr, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.widget_default_qr, View.GONE)
            }
        } else {
            val emptyAvatar = WidgetDataManager.createAvatarBitmap(
                initials = "+",
                colorHex = "#94A3B8",
                sizeDp = 44,
                context = context
            )
            views.setImageViewBitmap(R.id.widget_default_avatar, emptyAvatar)
            views.setTextViewText(R.id.widget_default_title, "Set Default Profile")
            views.setTextViewText(R.id.widget_default_subtitle, "Tap to configure in Settings")
            views.setViewVisibility(R.id.widget_default_qr, View.GONE)
        }

        val targetUri = if (data.hasDefault) "qrprofile://profile/default" else "qrprofile://settings"
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            setData(Uri.parse(targetUri))
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            102,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_default_root, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_avatar, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_title, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_subtitle, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_qr, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, DefaultProfileWideWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (allWidgetIds != null && allWidgetIds.isNotEmpty()) {
                val data = WidgetDataManager.loadDefaultProfile(context)
                val provider = DefaultProfileWideWidgetProvider()
                for (id in allWidgetIds) {
                    provider.updateWidget(context, appWidgetManager, id, data)
                }
            }
        }
    }
}
