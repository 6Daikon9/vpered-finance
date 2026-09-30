# Vpered / Вперёд

An offline personal budget calculator with Windows and Android installers and an iPhone source project. The interface is bundled inside the application. No bank connection, backend, computer connection or user account is required on the phone.

## Features

- Russian and English interface.
- Separate accounts, each with one fixed currency: PLN, EUR, USD, GBP, CHF, UAH, RUB, CZK, SEK, NOK, DKK, CAD, AUD.
- Opening balances, monthly/one-off income and expenses, custom categories, end dates and amount overrides.
- Forecasts for 3, 6 and 12 months per account. Different currencies are not added together.
- Transfers and currency exchange: enter the amount spent and the amount received. One record updates both accounts. The displayed exchange rate is derived from these amounts; no market rate is requested.
- Transfers are separate from income and expenses. Editing or deleting a transfer updates both sides.
- Import/export of a local JSON backup. Older single-account backups migrate to a PLN account without changing amounts.

## Local data

Android/iOS use Capacitor Preferences (SharedPreferences / UserDefaults). Windows stores an atomic JSON settings file in the application's user-data directory. The browser development preview uses localStorage only as a development fallback.

The application has no cloud synchronization or telemetry. Android's application manifest omits Internet permission and disables automatic Android backup. Windows blocks outgoing HTTP/WebSocket requests. Data on separate devices remains separate. To transfer a budget, export a file and import it on the other device.

Backups are not encrypted. Removing the app can remove its local data; export a backup first. Export uses the native share/save sheet on phones and a Save dialog on Windows.

## Build

Node 22+ is required for development.

```sh
npm ci
npm test
npm run build
```

Windows: `npm run package:windows` builds the NSIS installer. Use `npm run desktop` for a desktop development run after building the interface. Icons are included; regenerate them with `python scripts/generate-icons.py` (Pillow required).

Android: Java 21 and Android SDK platform 36/build-tools 36.0.0 are required. Run `npm run sync:mobile`, then `cd android` and `./gradlew assembleRelease` (`gradlew.bat assembleRelease` on Windows). The release APK must be signed using a private keystore kept outside version control. The CI workflow produces a clearly labelled development APK, not a store release.

iPhone: open `ios/App/App.xcodeproj` on macOS with Xcode 26+, resolve Swift packages, select your signing team and build for your device. Windows cannot create an installable, signed iPhone build. No Apple credentials or signing identities are included in this repository.

The source includes the required iOS privacy manifest. The app's HTML/CSS interface is rendered inside a native application shell; it does not load a hosted website.

## Validation and distribution

All 32 Vitest tests and the TypeScript/Vite production build passed. The packaged Windows application was checked with an isolated local profile: account currencies, exchange creation/editing/direction/deletion, forecast balances, persistence after restarting, RU/EN, native backup export/import, mobile-width layout and blocking outbound requests. Android's release build passed; its APK signature and packaged permissions were checked. Physical Android/iPhone testing has not been performed.

Windows is distributed as an unsigned NSIS installer (no publisher certificate). Android is distributed as an APK signed with the application's private release key, for installation directly on an Android 7+ device. It requests no Internet permission. iPhone currently has source only: a signed device build requires macOS/Xcode and the owner's Apple signing team. No IPA is included.

## По-русски

У каждого счёта своя валюта. Для обмена выберите счёт списания и счёт зачисления, затем введите обе суммы. Можно поменять направление. Программа рассчитывает курс по вашим значениям и меняет прогноз обоих счетов; доходы и расходы при этом не увеличиваются.

На телефоне приложение работает самостоятельно, с локальными данными. Для iPhone финальная сборка и подпись выполняются на Mac. Сервер на ПК и подключение к нему не требуются.
