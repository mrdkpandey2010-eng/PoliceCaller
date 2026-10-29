# Android Capacitor Build & Packaging Guide
## UP Police Directory & Realtime Messenger

### 1. Project Specifications
- **App ID:** `gov.in.uppolice.directory`
- **App Name:** `UP Police Directory`
- **Target SDK:** Android 34 (Android 14)
- **Minimum SDK:** Android 24 (Android 7.0)
- **Framework:** Capacitor 8 + Android Gradle Plugin 8.7.2

---

### 2. Permissions Architecture & Zero-Calling Guarantee

The Android manifest strictly excludes all calling and recording permissions:

```xml
<!-- ALLOWED PERMISSIONS -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- STRICTLY PROHIBITED PERMISSIONS (CONFIRMED ABSENT) -->
<!-- NO android.permission.RECORD_AUDIO -->
<!-- NO android.permission.MODIFY_AUDIO_SETTINGS -->
<!-- NO android.permission.CALL_PHONE -->
<!-- NO android.permission.READ_PHONE_STATE -->
```

---

### 3. Build & Packaging Commands

#### Prerequisites
- JDK 17 (Java Development Kit)
- Android Studio / Android SDK Platform 34
- Node.js v24+

#### Local Build Steps
```powershell
# 1. Build the web assets and PWA
npm run build --workspace=@police-directory/web

# 2. Sync web assets with Capacitor Android wrapper
npx cap sync android

# 3. Build Android Debug APK
cd android
./gradlew assembleDebug

# Output APK path:
# android/app/build/outputs/apk/debug/app-debug.apk
```

#### Production Signing
```powershell
# Build signed Android App Bundle (AAB) for deployment
cd android
./gradlew bundleRelease
```
