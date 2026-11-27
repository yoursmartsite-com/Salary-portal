package com.omnix.guard

import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.provider.Settings
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import java.security.MessageDigest
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.net.URI

private val bg = Color(0xFF090B0E)
private val panel = Color(0xFF171B21)
private val gold = Color(0xFFC6A76A)
private val muted = Color(0xFF9BA3AD)
private val white = Color(0xFFF4F1E9)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { GuardScreen() }
    }
}

@Composable
private fun GuardScreen() {
    val context = LocalContext.current
    var tab by remember { mutableStateOf("الرئيسية") }
    var link by remember { mutableStateOf("") }
    var result by remember { mutableStateOf("") }
    var apps by remember { mutableStateOf<List<String>>(emptyList()) }
    var fileReport by remember { mutableStateOf("لم يتم فحص أي ملف بعد.") }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) fileReport = scanSelectedFile(context, uri)
    }
    MaterialTheme(colorScheme = darkColorScheme(primary = gold, background = bg, surface = panel, onSurface = white)) {
        Scaffold(containerColor = bg, bottomBar = {
            NavigationBar(containerColor = panel) {
                listOf("الرئيسية", "التطبيقات", "الملفات", "الروابط", "الشبكة").forEach { t ->
                    NavigationBarItem(selected = tab == t, onClick = { tab = t },
                        icon = { Icon(when(t) { "التطبيقات" -> Icons.Default.Apps; "الروابط" -> Icons.Default.Link; "الملفات" -> Icons.Default.FolderOpen; "الشبكة" -> Icons.Default.Wifi; else -> Icons.Default.Shield }, null) },
                        label = { Text(t, fontSize = 10.sp) })
                }
            }
        }) { pad ->
            Column(Modifier.fillMaxSize().padding(pad).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Shield, null, tint = gold, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.width(10.dp))
                    Column { Text("OMNIX GUARD", color = white, fontSize = 21.sp, fontWeight = FontWeight.Bold); Text("مركز أمان جهازك", color = muted, fontSize = 12.sp) }
                }
                when(tab) {
                    "الرئيسية" -> {
                        Card(colors = CardDefaults.cardColors(containerColor = panel)) {
                            Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Shield, null, tint = gold, modifier = Modifier.size(58.dp))
                                Text("أدوات الأمان جاهزة", color = white, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                Text("ابدأ بمراجعة التطبيقات والروابط وإعدادات الجهاز.", color = muted)
                            }
                        }
                        GuardButton("فحص التطبيقات والصلاحيات") { tab = "التطبيقات" }
                        GuardButton("فحص رابط مشبوه") { tab = "الروابط" }
                        GuardButton("حالة اتصال الشبكة") { tab = "الشبكة" }
                        GuardButton("إعدادات أمان أندرويد") { context.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) }
                        Text("مساعد أمني مبدئي، وليس مضاد فيروسات أو ضمانًا ضد الاختراق.", color = muted, fontSize = 11.sp)
                    }
                    "التطبيقات" -> {
                        Text("التطبيقات وصلاحياتها", color = gold, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("يعرض التطبيقات القابلة للتشغيل والصلاحيات الحساسة المعلنة فقط.", color = muted, fontSize = 12.sp)
                        GuardButton("افحص التطبيقات") {
                            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                            apps = context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_ALL).mapNotNull {
                                val pkg = it.activityInfo.packageName
                                try {
                                    val p = context.packageManager.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS)
                                    val perms = p.requestedPermissions.orEmpty()
                                    val labels = mapOf("android.permission.CAMERA" to "كاميرا", "android.permission.RECORD_AUDIO" to "ميكروفون", "android.permission.ACCESS_FINE_LOCATION" to "موقع", "android.permission.READ_CONTACTS" to "جهات اتصال", "android.permission.READ_SMS" to "رسائل")
                                    val found = perms.filter { it in labels.keys }.mapNotNull { labels[it] }
                                    "• ${it.loadLabel(context.packageManager)} — ${found.joinToString().ifBlank { "لا توجد صلاحيات بالقائمة" }}"
                                } catch (_: Exception) { null }
                            }.distinct().sorted()
                        }
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) { items(apps) { Text(it, color = white, modifier = Modifier.fillMaxWidth().padding(10.dp)) } }
                    }
                    "الملفات" -> {
                        Text("فحص ملف أو APK", color = gold, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("اختر ملفًا من جهازك. يحسب التطبيق بصمة SHA-256، ويفحص صلاحيات APK إن أمكن. لا توجد قاعدة توقيعات فيروسات؛ النتيجة ليست حكمًا قاطعًا.", color = muted, fontSize = 12.sp)
                        GuardButton("اختيار ملف للفحص") { filePicker.launch(arrayOf("*/*")) }
                        Card(colors = CardDefaults.cardColors(containerColor = panel)) { Text(fileReport, color = white, modifier = Modifier.fillMaxWidth().padding(16.dp)) }
                    }
                    "الروابط" -> {
                        Text("فحص مبدئي للروابط", color = gold, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text("تحليل محلي للمؤشرات الواضحة فقط؛ لا يتحقق من سمعة المواقع.", color = muted, fontSize = 12.sp)
                        OutlinedTextField(value = link, onValueChange = { link = it; result = "" }, label = { Text("الصق الرابط") }, modifier = Modifier.fillMaxWidth())
                        GuardButton("افحص الرابط") { result = inspect(link) }
                        if (result.isNotBlank()) Text(result, color = white)
                    }
                    else -> {
                        Text("حالة الشبكة", color = gold, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text(network(context), color = white)
                        Text("هذا الفحص لا يكشف التجسس أو اختراق الشبكة.", color = muted, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun GuardButton(label: String, action: () -> Unit) {
    Button(onClick = action, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = gold, contentColor = bg)) { Text(label, fontWeight = FontWeight.Bold) }
}

private fun inspect(raw: String): String {
    if (raw.isBlank()) return "اكتب رابطًا أولًا."
    return try {
        val uri = URI(if (raw.contains("://")) raw.trim() else "https://${raw.trim()}")
        val host = uri.host ?: return "الرابط غير صالح أو غير واضح."
        val flags = mutableListOf<String>()
        if (uri.scheme != "https") flags += "لا يستخدم HTTPS"
        if (host.startsWith("xn--") || host.contains(".xn--")) flags += "اسم نطاق بترميز قد يخفي شكل الاسم"
        if (host.matches(Regex("""\\d{1,3}(\\.\\d{1,3}){3}"""))) flags += "يستخدم عنوان IP"
        if (uri.userInfo != null) flags += "يحتوي على بيانات قبل اسم النطاق"
        if (flags.isEmpty()) "لم تظهر مؤشرات واضحة؛ هذا لا يثبت أن الرابط آمن."
        else "تحذير: ${flags.joinToString(" • ")}. لا تفتحه إذا لم تثق بمصدره."
    } catch (_: Exception) { "تعذر تحليل الرابط." }
}

private fun network(context: android.content.Context): String {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    val n = cm.activeNetwork ?: return "لا يوجد اتصال نشط."
    val c = cm.getNetworkCapabilities(n) ?: return "تعذر قراءة الاتصال."
    val type = when {
        c.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
        c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
        c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "بيانات الهاتف"
        else -> "اتصال آخر"
    }
    return "$type — ${if (c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) "الإنترنت متاح" else "الإنترنت غير مؤكد"}."
}


private fun scanSelectedFile(context: android.content.Context, uri: Uri): String {
    return try {
        var name = "ملف مختار"
        context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cur ->
            if (cur.moveToFirst()) name = cur.getString(0) ?: name
        }
        val digest = MessageDigest.getInstance("SHA-256")
        var total = 0L
        context.contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
                total += count
            }
        } ?: return "تعذر فتح الملف."
        val hash = digest.digest().joinToString("") { "%02x".format(it) }
        val out = StringBuilder()
        out.append("الملف: " + name + "\nالحجم: " + total + " بايت\nSHA-256: " + hash + "\n\n")
        if (name.endsWith(".apk", true)) {
            val temp = java.io.File(context.cacheDir, "guard_scan_" + System.currentTimeMillis() + ".apk")
            context.contentResolver.openInputStream(uri)?.use { src -> temp.outputStream().use { dst -> src.copyTo(dst) } }
            try {
                @Suppress("DEPRECATION")
                val info = context.packageManager.getPackageArchiveInfo(temp.absolutePath, PackageManager.GET_PERMISSIONS)
                if (info == null) out.append("تعذر قراءة بيانات APK.\n")
                else {
                    out.append("معرّف التطبيق: " + info.packageName + "\n")
                    val labels = mapOf(
                        "android.permission.CAMERA" to "الكاميرا",
                        "android.permission.RECORD_AUDIO" to "الميكروفون",
                        "android.permission.ACCESS_FINE_LOCATION" to "الموقع الدقيق",
                        "android.permission.READ_CONTACTS" to "جهات الاتصال",
                        "android.permission.READ_SMS" to "الرسائل النصية",
                        "android.permission.RECEIVE_SMS" to "استقبال الرسائل",
                        "android.permission.READ_CALL_LOG" to "سجل المكالمات",
                        "android.permission.REQUEST_INSTALL_PACKAGES" to "تثبيت تطبيقات أخرى",
                        "android.permission.SYSTEM_ALERT_WINDOW" to "الظهور فوق التطبيقات"
                    )
                    val found = info.requestedPermissions.orEmpty().mapNotNull { labels[it] }
                    out.append("صلاحيات تستحق المراجعة: " + found.distinct().joinToString().ifBlank { "لم تظهر صلاحيات من القائمة المحددة" } + "\n")
                    out.append("الصلاحيات وحدها لا تثبت أن التطبيق خبيث أو آمن.\n")
                }
            } finally { temp.delete() }
        } else out.append("تم حساب البصمة فقط. اختر APK لتحليل الصلاحيات أيضًا.\n")
        out.append("\nلا توجد مطابقة مع قاعدة برمجيات خبيثة في هذه النسخة.")
        out.toString()
    } catch (e: Exception) { "فشل الفحص: " + (e.message ?: "خطأ غير معروف") }
}
