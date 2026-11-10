# Metro Dash 3D

Original 3D endless runner (React + TypeScript + Vite + Three.js, packaged for Android with Capacitor 8).
Characters (Ankit, Arya, Aman, Aashi), trains, obstacles, pick-ups and the station background come from the supplied art sheets in `public/art/`; audio is synthesised at runtime.

## Requirements
- Node.js 22+ and npm
- For the APK: Android Studio (current stable), JDK 21, Android SDK platform + build-tools (installed via Android Studio)

## Run in the browser (desktop testing)
    npm install
    npm run test:logic     # headless tests: obstacle fairness, collision, score, save
    npm run dev            # open the printed URL
Keys: arrows / WASD / Space (jump), P or Esc (pause). On a phone browser use swipes.

## Build the Android APK
    npm install
    npm run android:add    # once: creates android/ and patches portrait + immersive full-screen
    npm run android:apk    # builds web bundle, syncs to Android, runs Gradle assembleDebug
APK output: android/app/build/outputs/apk/debug/app-debug.apk
Install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
Or open in Android Studio: `npm run android:open`, then Run on a device/emulator.
After any web code change: `npm run android:sync`.
(Release build: Build > Generate Signed Bundle/APK in Android Studio.)

## Project layout
    src/game/        GameEngine, PlayerController, PlayerAnimationController, PoliceChaseController,
                     TrackGenerator, ObstacleSpawner (+ PatternGenerator), CollisionSystem, CoinSystem,
                     PowerUpSystem, ScoreSystem, AudioManager, CameraController, GameStateManager,
                     SaveManager, InputController, ParticleSystem, CharacterFactory, Assets
    src/components/  MainMenu, GameScreen, GameHUD, CharacterSelection, ShopScreen, MissionScreen,
                     PauseScreen, GameOverScreen, SettingsScreen, DailyRewardScreen, LeaderboardScreen
    src/data/        catalog.ts (characters, outfits, upgrades, missions, daily rewards)
    public/art/      supplied artwork cut into game assets (chars/, sprites/, trains/, backdrop, mural, station)
    public/models/   optional .glb characters (see README there)
    scripts/         logic-test.ts, patch-android.mjs

## Manual test checklist (run on a device)
1. Menu: every button opens its screen; Back returns. Play starts a run.
2. Swipe left/right changes lane; up jumps; down slides (in the air: fast-fall + roll).
3. Hit a low obstacle: stumble, police closes in. Hit a second one soon after: caught, Game Over.
4. Run into a train head-on: immediate crash. Collect coins: counter rises, sound plays.
5. Grab each power-up (magnet, jetpack, sneakers, hoverboard, x2, booster): HUD icon + timer appears.
6. Pause, Resume, Restart, Home from the pause panel; sound sliders and mute work.
7. Game Over: score/best/coins shown; Restart, Home, Revive (costs coins) work.
8. Close and reopen the app: coins, best score, selected character, unlocks, missions, settings persist.
9. Press Home / switch apps mid-run: the game pauses automatically.
10. Airplane mode: everything still works (fully offline).
