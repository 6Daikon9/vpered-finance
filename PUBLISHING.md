# Release maintenance

The public project contains application source only. Attach the Windows installer, signed Android APK and their SHA-256 checksums as release assets.

Before each release:

1. Run `npm ci`, `npm test`, `npm run build` and `npm run sync:mobile`.
2. Increment package/native versions; increment Android versionCode for updates.
3. Build Windows with `npm run package:windows`. Publisher signing requires a separately supplied certificate; the first installer is unsigned.
4. Build Android from the `android` directory with `gradlew assembleRelease`, then align and sign its APK. Reuse the existing private signing key for compatible updates. Never commit keys or passwords.
5. Check native startup, local persistence, transfers and backups. Check Android notification permission denial/grant, exact/inexact alarms, paid/edit/delete cancellation, app restart and device reboot on a physical device when available; clearly disclose missing device validation. Verify the final Android manifest has no Internet permission and that APK signature verification passes.
6. Inspect `git diff --cached` and release assets for secrets, personal data and generated caches before pushing.

The GitHub Actions workflow runs source checks and builds a labelled Android development APK. It does not hold private signing credentials or automatically publish releases.

The iPhone project needs Xcode on macOS and an Apple signing team. Do not describe the source project as a ready-to-install iPhone application.

Public visibility was requested; no source-code license has been chosen on the owner's behalf.
