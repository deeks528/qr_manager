package com.tempqrmanager.widgets

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.io.File

data class WidgetProfileData(
    val hasDefault: Boolean,
    val nickname: String,
    val initials: String,
    val avatarColor: String,
    val subtitle: String,
    val qrPayload: String = "",
    val imagePath: String? = null
)

object WidgetDataManager {
    private const val PREFS_NAME = "widget_prefs"
    private const val KEY_HAS_DEFAULT = "has_default_profile"
    private const val KEY_NICKNAME = "profile_nickname"
    private const val KEY_INITIALS = "profile_initials"
    private const val KEY_COLOR = "profile_avatar_color"
    private const val KEY_SUBTITLE = "profile_subtitle"
    private const val KEY_QR_PAYLOAD = "profile_qr_payload"
    private const val KEY_IMAGE_PATH = "profile_image_path"

    fun saveDefaultProfile(
        context: Context,
        hasDefault: Boolean,
        nickname: String?,
        initials: String?,
        avatarColor: String?,
        subtitle: String?,
        qrPayload: String?,
        imagePath: String?
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_HAS_DEFAULT, hasDefault)
            putString(KEY_NICKNAME, nickname ?: "")
            putString(KEY_INITIALS, initials ?: "")
            putString(KEY_COLOR, avatarColor ?: "#2563EB")
            putString(KEY_SUBTITLE, subtitle ?: "")
            putString(KEY_QR_PAYLOAD, qrPayload ?: "")
            putString(KEY_IMAGE_PATH, imagePath ?: "")
            apply()
        }
    }

    fun loadDefaultProfile(context: Context): WidgetProfileData {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.contains(KEY_HAS_DEFAULT)) {
            val hasDefault = prefs.getBoolean(KEY_HAS_DEFAULT, false)
            val nickname = prefs.getString(KEY_NICKNAME, "") ?: ""
            val initials = prefs.getString(KEY_INITIALS, "") ?: ""
            val color = prefs.getString(KEY_COLOR, "#2563EB") ?: "#2563EB"
            val subtitle = prefs.getString(KEY_SUBTITLE, "") ?: ""
            val qrPayload = prefs.getString(KEY_QR_PAYLOAD, "") ?: ""
            val imagePath = prefs.getString(KEY_IMAGE_PATH, null)
            return WidgetProfileData(hasDefault, nickname, initials, color, subtitle, qrPayload, imagePath)
        }

        // Fallback: Read directly from SQLite database if SharedPreferences not set yet
        return queryDatabaseForDefaultProfile(context)
    }

    private fun queryDatabaseForDefaultProfile(context: Context): WidgetProfileData {
        try {
            val dbFile = context.getDatabasePath("universal_qr_profiles.db")
            if (dbFile != null && dbFile.exists()) {
                val db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READONLY)
                val cursor = db.rawQuery(
                    """
                    SELECT p.id, p.nickname, p.avatarColor, p.type 
                    FROM settings s 
                    INNER JOIN profiles p ON s.defaultProfileId = p.id 
                    WHERE s.id = 1 
                    LIMIT 1
                    """.trimIndent(),
                    null
                )

                if (cursor.moveToFirst()) {
                    val profileId = cursor.getString(0) ?: ""
                    val nickname = cursor.getString(1) ?: ""
                    val avatarColor = cursor.getString(2) ?: "#2563EB"
                    val type = cursor.getInt(3)
                    cursor.close()

                    var subtitle = ""
                    var qrPayload = ""
                    var imagePath: String? = null

                    when (type) {
                        0 -> { // UPI
                            val upiCursor = db.rawQuery(
                                "SELECT upiId, minimumAmount, defaultDescription FROM upi_profiles WHERE profileId = ? LIMIT 1",
                                arrayOf(profileId)
                            )
                            if (upiCursor.moveToFirst()) {
                                val upiId = upiCursor.getString(0) ?: ""
                                val minAmount = if (!upiCursor.isNull(1)) upiCursor.getDouble(1) else null
                                val desc = upiCursor.getString(2)

                                subtitle = upiId
                                qrPayload = buildUPIPayload(upiId, nickname, minAmount, desc)
                            }
                            upiCursor.close()
                        }
                        1 -> { // WhatsApp
                            val waCursor = db.rawQuery(
                                "SELECT mobileNumber FROM whatsapp_profiles WHERE profileId = ? LIMIT 1",
                                arrayOf(profileId)
                            )
                            if (waCursor.moveToFirst()) {
                                val mobile = waCursor.getString(0) ?: ""
                                subtitle = mobile
                                qrPayload = "https://wa.me/${mobile.replace("+", "")}"
                            }
                            waCursor.close()
                        }
                        2 -> { // Custom
                            val custCursor = db.rawQuery(
                                "SELECT text FROM custom_profiles WHERE profileId = ? LIMIT 1",
                                arrayOf(profileId)
                            )
                            if (custCursor.moveToFirst()) {
                                qrPayload = custCursor.getString(0) ?: ""
                                subtitle = "Custom Account"
                            }
                            custCursor.close()
                        }
                        3 -> { // Other
                            val otherCursor = db.rawQuery(
                                "SELECT imagePath FROM other_profiles WHERE profileId = ? LIMIT 1",
                                arrayOf(profileId)
                            )
                            if (otherCursor.moveToFirst()) {
                                imagePath = otherCursor.getString(0)
                                subtitle = "Other Account"
                            }
                            otherCursor.close()
                        }
                    }

                    db.close()

                    val initials = extractInitials(nickname)
                    if (subtitle.isEmpty()) subtitle = "$nickname Account"

                    // Cache for future instant reads
                    saveDefaultProfile(context, true, nickname, initials, avatarColor, subtitle, qrPayload, imagePath)
                    return WidgetProfileData(true, nickname, initials, avatarColor, subtitle, qrPayload, imagePath)
                }

                cursor.close()
                db.close()
            }
        } catch (e: Exception) {
            // Silently fall back to no default profile state
        }

        return WidgetProfileData(
            hasDefault = false,
            nickname = "",
            initials = "",
            avatarColor = "#94A3B8",
            subtitle = "Set Default Profile",
            qrPayload = "",
            imagePath = null
        )
    }

    private fun buildUPIPayload(
        upiId: String,
        nickname: String,
        minAmount: Double?,
        desc: String?
    ): String {
        val sb = StringBuilder("upi://pay?")
        sb.append("pa=").append(android.net.Uri.encode(upiId))
        sb.append("&pn=").append(android.net.Uri.encode(nickname))
        if (minAmount != null && minAmount > 0) {
            sb.append("&am=").append(String.format(java.util.Locale.US, "%.2f", minAmount))
        }
        sb.append("&cu=INR")
        if (!desc.isNullOrEmpty()) {
            sb.append("&tn=").append(android.net.Uri.encode(desc))
        }
        return sb.toString()
    }

    private fun extractInitials(name: String): String {
        val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            words.isEmpty() -> "UP"
            words.size == 1 -> words[0].take(2).uppercase()
            else -> "${words[0].first().uppercase()}${words[1].first().uppercase()}"
        }
    }

    fun createAvatarBitmap(
        initials: String,
        colorHex: String,
        sizeDp: Int,
        context: Context
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        val sizePx = (sizeDp * density).toInt().coerceAtLeast(40)
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = try {
                Color.parseColor(colorHex)
            } catch (e: Exception) {
                Color.parseColor("#2563EB")
            }
            style = Paint.Style.FILL
        }

        val radius = sizePx / 2f
        canvas.drawCircle(radius, radius, radius, paint)

        if (initials.isNotEmpty()) {
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textSize = sizePx * 0.42f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.CENTER
            }
            val textY = radius - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(initials, radius, textY, textPaint)
        }

        return bitmap
    }

    private var cachedQrKey: String? = null
    private var cachedQrBitmap: Bitmap? = null

    fun createQrBitmap(
        payload: String,
        imagePath: String?,
        sizeDp: Int,
        context: Context
    ): Bitmap? {
        val density = context.resources.displayMetrics.density
        val sizePx = (sizeDp * density).toInt().coerceAtLeast(240)
        val cacheKey = "${payload}_${imagePath}_$sizePx"

        synchronized(this) {
            if (cachedQrKey == cacheKey && cachedQrBitmap != null && !cachedQrBitmap!!.isRecycled) {
                return cachedQrBitmap
            }
        }

        // If an imagePath is given (Other profile type)
        if (!imagePath.isNullOrEmpty()) {
            try {
                val cleanPath = imagePath.replace("file://", "")
                val file = File(cleanPath)
                if (file.exists()) {
                    val opts = BitmapFactory.Options().apply {
                        inJustDecodeBounds = true
                    }
                    BitmapFactory.decodeFile(cleanPath, opts)
                    val inSampleSize = (opts.outWidth / sizePx).coerceAtLeast(1)
                    val decodeOpts = BitmapFactory.Options().apply {
                        this.inSampleSize = inSampleSize
                    }
                    val rawBitmap = BitmapFactory.decodeFile(cleanPath, decodeOpts)
                    if (rawBitmap != null) {
                        val scaled = Bitmap.createScaledBitmap(rawBitmap, sizePx, sizePx, true)
                        synchronized(this) {
                            cachedQrKey = cacheKey
                            cachedQrBitmap = scaled
                        }
                        return scaled
                    }
                }
            } catch (e: Exception) {
                // Ignore and fall through to payload
            }
        }

        if (payload.isEmpty()) {
            return null
        }

        return try {
            val hints = HashMap<EncodeHintType, Any>().apply {
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
                put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M)
                put(EncodeHintType.MARGIN, 0)
            }
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(payload, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
            val pixels = IntArray(sizePx * sizePx)
            val darkColor = Color.parseColor("#0F172A")
            val lightColor = Color.WHITE

            for (y in 0 until sizePx) {
                val offset = y * sizePx
                for (x in 0 until sizePx) {
                    pixels[offset + x] = if (bitMatrix.get(x, y)) darkColor else lightColor
                }
            }

            val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
            bitmap.setPixels(pixels, 0, sizePx, 0, 0, sizePx, sizePx)

            synchronized(this) {
                cachedQrKey = cacheKey
                cachedQrBitmap = bitmap
            }
            bitmap
        } catch (e: Exception) {
            null
        }
    }
}
