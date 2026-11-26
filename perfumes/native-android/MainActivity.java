package com.zeinrahaf.perfumes;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.pm.PackageInfo;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean updateDialogShown = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mainHandler.postDelayed(this::checkMandatoryUpdate, 500);
    }

    private long installedVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= 28) return info.getLongVersionCode();
            return info.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private void checkMandatoryUpdate() {
        if (isFinishing() || isDestroyed()) return;
        updateExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL("https://yoursmartsite-com.github.io/Salary-portal/perfumes/android-update.json?check=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(7000);
                connection.setReadTimeout(7000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
                connection.setRequestProperty("Pragma", "no-cache");
                int status = connection.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) return;
                StringBuilder body = new StringBuilder();
                try (InputStream input = connection.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }
                JSONObject data = new JSONObject(body.toString());
                long latest = data.optLong("versionCode", 0);
                long minimum = data.optLong("minVersionCode", 0);
                boolean force = data.optBoolean("force", false);
                String apkUrl = data.optString("apkUrl", "");
                String message = data.optString("message", "يوجد تحديث جديد للتطبيق، يجب تثبيته للمتابعة.");
                long installed = installedVersionCode();
                boolean mustUpdate = installed < minimum || (force && installed < latest);
                if (!mustUpdate || apkUrl.isEmpty()) return;
                mainHandler.post(() -> showMandatoryUpdate(apkUrl, message));
            } catch (Exception ignored) {
                // If the update service is temporarily unreachable, keep the app usable.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private void showMandatoryUpdate(String apkUrl, String message) {
        if (isFinishing() || isDestroyed() || updateDialogShown) return;
        updateDialogShown = true;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("تحديث إجباري — زين ورهف")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("تحديث التطبيق الآن", (d, which) -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {
                    updateDialogShown = false;
                }
            })
            .create();
        dialog.setCanceledOnTouchOutside(false);
        dialog.setOnCancelListener(d -> updateDialogShown = false);
        dialog.show();
    }

    @Override
    protected void onDestroy() {
        updateExecutor.shutdownNow();
        super.onDestroy();
    }
}
