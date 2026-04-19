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
