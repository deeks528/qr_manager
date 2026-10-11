package com.tempqrmanager.widgets

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    @ReactMethod
    fun updateDefaultProfileWidget(
        hasDefault: Boolean,
        nickname: String?,
        initials: String?,
        avatarColor: String?,
        subtitle: String?,
        qrPayload: String?,
        imagePath: String?
    ) {
        WidgetDataManager.saveDefaultProfile(
            context = reactContext,
            hasDefault = hasDefault,
            nickname = nickname,
            initials = initials,
            avatarColor = avatarColor,
            subtitle = subtitle,
            qrPayload = qrPayload,
            imagePath = imagePath
        )
        DefaultProfileWidgetProvider.updateAllWidgets(reactContext)
        DefaultProfileWideWidgetProvider.updateAllWidgets(reactContext)
        ScanQrCompactWidgetProvider.updateAllWidgets(reactContext)
        ScanQrSmallWidgetProvider.updateAllWidgets(reactContext)
    }

    @ReactMethod
    fun reloadAllWidgets() {
        DefaultProfileWidgetProvider.updateAllWidgets(reactContext)
        DefaultProfileWideWidgetProvider.updateAllWidgets(reactContext)
        ScanQrCompactWidgetProvider.updateAllWidgets(reactContext)
        ScanQrSmallWidgetProvider.updateAllWidgets(reactContext)
    }
}
