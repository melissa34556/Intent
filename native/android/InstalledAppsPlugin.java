package nl.intent.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "InstalledApps")
public class InstalledAppsPlugin extends Plugin {
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> activities = packageManager.queryIntentActivities(launcherIntent, 0);
            Collections.sort(activities, (left, right) ->
                left.loadLabel(packageManager).toString().compareToIgnoreCase(right.loadLabel(packageManager).toString())
            );

            JSArray apps = new JSArray();
            Set<String> seenPackages = new HashSet<>();
            String ownPackage = getContext().getPackageName();

            for (ResolveInfo info : activities) {
                String packageName = info.activityInfo.packageName;
                if (packageName.equals(ownPackage) || !seenPackages.add(packageName)) continue;

                String name = info.loadLabel(packageManager).toString();
                Drawable drawable = info.loadIcon(packageManager);
                String icon = drawableToDataUrl(drawable);

                JSObject app = new JSObject();
                app.put("packageName", packageName);
                app.put("name", name);
                app.put("icon", icon);
                apps.put(app);
            }

            JSObject result = new JSObject();
            result.put("apps", apps);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Kon geïnstalleerde apps niet ophalen.", error);
        }
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.trim().isEmpty()) {
            call.reject("Geen app geselecteerd.");
            return;
        }

        try {
            Intent launchIntent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (launchIntent == null) {
                call.reject("Deze app kan niet worden geopend.");
                return;
            }
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(launchIntent);
            call.resolve();
        } catch (Exception error) {
            call.reject("App openen is niet gelukt.", error);
        }
    }

    private String drawableToDataUrl(Drawable drawable) throws Exception {
        int width = Math.max(1, drawable.getIntrinsicWidth());
        int height = Math.max(1, drawable.getIntrinsicHeight());
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
        bitmap.recycle();
        return "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    }
}
