#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="android/app/src/main/java/nl/intent/app"
mkdir -p "$PACKAGE_DIR"
cp native/android/InstalledAppsPlugin.java "$PACKAGE_DIR/InstalledAppsPlugin.java"

cat > "$PACKAGE_DIR/MainActivity.java" <<'JAVA'
package nl.intent.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InstalledAppsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA

python3 - <<'PY'
from pathlib import Path
manifest = Path("android/app/src/main/AndroidManifest.xml")
content = manifest.read_text()
permission = '    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />\n'
if "android.permission.QUERY_ALL_PACKAGES" not in content:
    content = content.replace("<application", permission + "    <application", 1)
manifest.write_text(content)
PY
