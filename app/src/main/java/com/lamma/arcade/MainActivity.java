package com.lamma.arcade;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.DownloadListener;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.ValueCallback;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String SITE_HOST = "yoursmartsite-com.github.io";
    private static final String SITE_PREFIX = "/Salary-portal/";
    private static final String HOME = "https://" + SITE_HOST + SITE_PREFIX + "index.html";
    private static final String UPDATE_JSON = "https://raw.githubusercontent.com/yoursmartsite-com/Salary-portal/main/android-update.json";
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final int INSTALL_PERMISSION_REQUEST = 4103;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private DownloadManager downloadManager;
    private long pendingDownloadId = -1L;
    private String pendingApkUrl;
    private String pendingUpdateMessage;
    private boolean pendingForce;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (id == pendingDownloadId) installDownloadedApk();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 16, 32));
        getWindow().setNavigationBarColor(Color.rgb(7, 11, 23));
        downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(downloadReceiver, filter);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 11, 23));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " LammaAndroid/1.2");

        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                Uri page = Uri.parse(url);
                boolean hubPage = SITE_HOST.equals(page.getHost())
                    && page.getPath() != null
                    && page.getPath().equals(SITE_PREFIX + "hub.html");
                setRequestedOrientation(hubPage
                    ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveBundledSite(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || !url.toLowerCase().contains(".apk")) {
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage("نوع الملف ده مش مدعوم للتنزيل من داخل التطبيق.")
                    .setPositiveButton("حسناً", null).show();
                return;
            }
            pendingApkUrl = url;
            beginUpdateDownload();
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });
        setContentView(webView);
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            if (webView.getUrl() == null) webView.loadUrl(HOME);
        } else webView.loadUrl(HOME);

        checkForUpdate();
    }

    private void checkForUpdate() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(UPDATE_JSON).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Cache-Control", "no-cache");
                connection.connect();
                if (connection.getResponseCode() != 200) return;
                InputStream in = connection.getInputStream();
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int count;
                while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                in.close();
                JSONObject data = new JSONObject(out.toString("UTF-8"));
                int latestCode = data.optInt("versionCode", 0);
                if (latestCode <= BuildConfig.VERSION_CODE) return;

                // Show each published version only once on this device.
                android.content.SharedPreferences prefs =
                    getSharedPreferences("lamma_update_state", MODE_PRIVATE);
                int lastNotifiedCode = prefs.getInt("last_notified_version_code", 0);
                if (latestCode <= lastNotifiedCode) return;

                String apkUrl = data.optString("apkUrl", "");
                if (apkUrl.isEmpty()) return;
                String message = data.optString("message", "فيه تحديث جديد لتطبيق لَمّة.");
                boolean force = data.optBoolean("force", false);
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    prefs.edit().putInt("last_notified_version_code", latestCode).apply();
                    showUpdateDialog(apkUrl, message, force);
                });
            } catch (Exception ignored) {
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void showUpdateDialog(String apkUrl, String message, boolean force) {
        pendingApkUrl = apkUrl;
        pendingUpdateMessage = message;
        pendingForce = force;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("تحديث جديد من لَمّة")
            .setMessage(message + "\n\nالإصدار الجديد جاهز للتثبيت.")
            .setPositiveButton("تحديث الآن", (d, w) -> beginUpdateDownload())
            .setCancelable(!force)
            .create();
        if (!force) dialog.setButton(AlertDialog.BUTTON_NEGATIVE, "لاحقاً", (d, w) -> d.dismiss());
        dialog.show();
    }

    private void beginUpdateDownload() {
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getPackageName()));
            startActivityForResult(permission, INSTALL_PERMISSION_REQUEST);
            return;
        }
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(pendingApkUrl));
            request.setTitle("تحديث لَمّة");
            request.setDescription("جاري تنزيل التحديث...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "lamma-update.apk");
            request.setMimeType("application/vnd.android.package-archive");
            pendingDownloadId = downloadManager.enqueue(request);
            new AlertDialog.Builder(this).setTitle("جاري التحديث")
                .setMessage("هنبلغك لما التنزيل يكتمل. افتح الإشعار لتثبيت التحديث.")
                .setPositiveButton("حسناً", null).show();
        } catch (Exception e) {
            new AlertDialog.Builder(this).setMessage("تعذر بدء تنزيل التحديث. تأكد من اتصال الإنترنت وحاول مرة أخرى.")
                .setPositiveButton("حسناً", null).show();
        }
    }

    private void installDownloadedApk() {
        try {
            File apk = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "lamma-update.apk");
            if (!apk.exists() || apk.length() == 0) throw new IOException("APK missing");
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(install);
        } catch (Exception e) {
            new AlertDialog.Builder(this).setMessage("التنزيل اكتمل لكن تعذر فتح المثبّت. افتح إشعار التنزيل وحاول التثبيت.")
                .setPositiveButton("حسناً", null).show();
        }
    }

    // Live-first delivery: published site files are used whenever online.
    // The APK-bundled copy remains a fallback so the app can still open offline.
    private WebResourceResponse serveBundledSite(Uri uri) {
        if (!SITE_HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.equals("/")) path = SITE_PREFIX + "index.html";
        if (path.equals("/Salary-portal")) path = SITE_PREFIX + "index.html";
        if (!path.startsWith(SITE_PREFIX)) return null;
        String relative = Uri.decode(path.substring(SITE_PREFIX.length()));
        if (relative.isEmpty()) relative = "index.html";
        if (relative.contains("..") || relative.startsWith("/"))
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", new HashMap<>(), new ByteArrayInputStream(new byte[0]));

        WebResourceResponse live = fetchLiveSiteFile(uri, relative);
        if (live != null) return live;

        try {
            InputStream stream = getAssets().open("Salary-portal/" + relative, android.content.res.AssetManager.ACCESS_STREAMING);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse(mimeType(relative), "UTF-8", 200, "OK", headers, stream);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private WebResourceResponse fetchLiveSiteFile(Uri uri, String relative) {
        HttpURLConnection connection = null;
        try {
            URL requested = new URL(uri.toString());
            connection = (HttpURLConnection) requested.openConnection();
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(6000);
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty("User-Agent", "LammaAndroid-LiveContent/1.0");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return null;
            URL finalUrl = connection.getURL();
            if (!SITE_HOST.equals(finalUrl.getHost())) return null;

            String contentType = connection.getContentType();
            String mime = mimeType(relative);
            String encoding = "UTF-8";
            if (contentType != null) {
                String[] parts = contentType.split(";");
                if (parts.length > 0 && parts[0].contains("/")) mime = parts[0].trim();
                for (String part : parts) {
                    String item = part.trim();
                    if (item.toLowerCase().startsWith("charset=")) encoding = item.substring(8).replace("\"", "").trim();
                }
            }

            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-store");
            headers.put("X-Lamma-Content-Source", "live");
            return new WebResourceResponse(mime, encoding, status, "OK", headers,
                new ByteArrayInputStream(bytes.toByteArray()));
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String mimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".glb")) return "model/gltf-binary";
        if (lower.endsWith(".gltf")) return "model/gltf+json";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        } else if (requestCode == INSTALL_PERMISSION_REQUEST) {
            if (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls()) beginUpdateDownload();
            else new AlertDialog.Builder(this).setMessage("لازم تسمح للَمّة بتثبيت التحديثات من هذا المصدر.")
                .setPositiveButton("حسناً", null).show();
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (webView != null) { webView.stopLoading(); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
