# Local Android Build (No EAS Cloud Limits)

If EAS cloud fails because of upload/size limits, build directly on your machine.

## 1) Prerequisites

- Java 17 installed (`java -version`)
- Android Studio installed
- Android SDK + Build Tools installed
- Environment variables configured:
  - `ANDROID_HOME` (or `ANDROID_SDK_ROOT`)
  - `JAVA_HOME`
- Accept Android licenses:
  - `sdkmanager --licenses`

## 2) Install dependencies

From `mobile`:

```bash
npm install
```

## 3) Build locally

From `mobile`:

```bash
npm run build:apk:local
```

For App Bundle:

```bash
npm run build:aab:local
```

## 3.1) Make it an official signed release (required for production)

Your project now supports release signing via Gradle properties. Add these lines to
`mobile/android/gradle.properties` (or user-level `~/.gradle/gradle.properties`):

```properties
MYAPP_UPLOAD_STORE_FILE=../keystore/upload-keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

Create the keystore once (from `mobile/android`):

```bash
keytool -genkeypair -v -storetype JKS -keystore ../keystore/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Without these properties, release builds will fallback to debug signing (fine for local testing, not for official distribution).

### Faster rebuilds (without clean prebuild)

```bash
npm run build:apk:local:quick
npm run build:aab:local:quick
```

## 4) Output paths

- APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

## 5) If you still want EAS but no cloud upload

You can also run EAS local builds:

```bash
npx eas build --platform android --profile preview --local
```

This runs on your machine instead of EAS cloud.
