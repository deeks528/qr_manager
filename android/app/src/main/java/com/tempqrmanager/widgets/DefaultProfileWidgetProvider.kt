package com.tempqrmanager.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.tempqrmanager.MainActivity
import com.tempqrmanager.R

class DefaultProfileWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val data = WidgetDataManager.loadDefaultProfile(context)

        for (appWidgetId in appWidgetIds) {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
            val isWide = minWidth >= 220
            updateWidget(context, appWidgetManager, appWidgetId, data, isWide)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?
    ) {
        val minWidth = newOptions?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
        val isWide = minWidth >= 220
        val data = WidgetDataManager.loadDefaultProfile(context)
        updateWidget(context, appWidgetManager, appWidgetId, data, isWide)
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        data: WidgetProfileData,
        isWide: Boolean
    ) {
        val layoutId = if (isWide) R.layout.widget_default_profile_wide else R.layout.widget_default_profile
        val views = RemoteViews(context.packageName, layoutId)

        if (data.hasDefault && data.nickname.isNotEmpty()) {
            val avatarBitmap = WidgetDataManager.createAvatarBitmap(
                initials = if (data.initials.isNotEmpty()) data.initials else "UP",
                colorHex = data.avatarColor,
                sizeDp = if (isWide) 44 else 30,
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
                sizeDp = if (isWide) 120 else 110,
                context = context
            )

            if (qrBitmap != null) {
                views.setImageViewBitmap(R.id.widget_default_qr, qrBitmap)
                views.setViewVisibility(R.id.widget_default_qr, View.VISIBLE)
                if (!isWide) {
                    views.setViewVisibility(R.id.widget_default_empty_hint, View.GONE)
                }
            } else {
                views.setViewVisibility(R.id.widget_default_qr, View.GONE)
                if (!isWide) {
                    views.setViewVisibility(R.id.widget_default_empty_hint, View.VISIBLE)
                }
            }
        } else {
            // Muted placeholder state encouraging user to configure default
            val emptyAvatar = WidgetDataManager.createAvatarBitmap(
                initials = "+",
                colorHex = "#94A3B8",
                sizeDp = if (isWide) 44 else 30,
                context = context
            )
            views.setImageViewBitmap(R.id.widget_default_avatar, emptyAvatar)
            views.setTextViewText(R.id.widget_default_title, "Set Default Profile")
            views.setTextViewText(R.id.widget_default_subtitle, "Tap to configure in Settings")
            views.setViewVisibility(R.id.widget_default_qr, View.GONE)
            if (!isWide) {
                views.setViewVisibility(R.id.widget_default_empty_hint, View.VISIBLE)
            }
        }

        // Deep link to open the default profile directly
        val targetUri = if (data.hasDefault) "qrprofile://profile/default" else "qrprofile://settings"
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            setData(Uri.parse(targetUri))
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            101,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_default_root, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_avatar, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_title, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_subtitle, pendingIntent)
        views.setOnClickPendingIntent(R.id.widget_default_qr, pendingIntent)
        if (!isWide) {
            views.setOnClickPendingIntent(R.id.widget_default_empty_hint, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, DefaultProfileWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            if (allWidgetIds != null && allWidgetIds.isNotEmpty()) {
                val data = WidgetDataManager.loadDefaultProfile(context)
                val provider = DefaultProfileWidgetProvider()
                for (id in allWidgetIds) {
                    val options = appWidgetManager.getAppWidgetOptions(id)
                    val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
                    provider.updateWidget(context, appWidgetManager, id, data, minWidth >= 220)
                }
            }
        }
    }
}
