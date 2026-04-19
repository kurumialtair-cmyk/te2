# Publish as Official Android App

This is the production path (not just transferring a file manually).

## 1) Build a production-signed AAB

1. Configure keystore signing (see `LOCAL_BUILD.md`).
2. Build:

```bash
npm run build:aab:local
```

Output:

- `android/app/build/outputs/bundle/release/app-release.aab`

## 2) Upload to Google Play Console

1. Create app in Google Play Console.
2. Complete required store listing:
   - App name, description, screenshots, icon, feature graphic
   - Privacy policy URL
3. Set Data safety and Content rating questionnaires.
4. Upload `app-release.aab` to **Internal testing** first.
5. Add tester emails, publish internal track.
6. Test install via Play link (this behaves like official install flow).

## 3) Move to production

After testing:

1. Promote release from internal -> closed/open -> production.
2. Increment app version for next releases:
   - `android/app/build.gradle` -> `versionCode` (must increase every release)
   - `versionName` (human-readable version)
3. Build and upload new AAB.

## 4) Installable file outside Play (optional)

If you need direct install for clients:

```bash
npm run build:apk:local
```

Use APK for sideloading. Use AAB for Play Store official distribution.
