// Run after `npx cap add android` / `npx cap sync android`.
// Locks the app to portrait, enables immersive full-screen, and keeps the screen awake while playing.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'android');
if (!existsSync(root)) {
  console.error('android/ not found. Run `npx cap add android` first.');
  process.exit(1);
}

// 1. AndroidManifest: portrait + keep configChanges so the WebView is not recreated on resize
const manifestPath = join(root, 'app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:screenOrientation')) {
  manifest = manifest.replace('<activity', '<activity\n            android:screenOrientation="portrait"');
}
writeFileSync(manifestPath, manifest);

// 2. MainActivity: immersive sticky full-screen + keep screen on
const javaDir = join(root, 'app/src/main/java/com/metrodash/game');
const activity = join(javaDir, 'MainActivity.java');
if (existsSync(activity)) {
  writeFileSync(
    activity,
    `package com.metrodash.game;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        if (c != null) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
`,
  );
  console.log('Patched MainActivity.java');
} else {
  console.warn('MainActivity.java not found at', activity);
}
console.log('Android project patched (portrait + immersive).');
