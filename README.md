# Vpered / Вперёд

An offline personal budget calculator for Windows and Android. The interface is bundled inside the application. No bank connection, backend, computer connection or user account is required on the phone.

## Features

- Optional payment days, upcoming/overdue lists and paid/received marks without double-counting.
- Offline Android reminders with 0–365 days of advance notice, local time and optional due-day alerts.

- Russian and English interface.
- Light/dark theme with local persistence.
- Separate default and custom category suggestions for income and expenses.
- The forecast headline follows the selected month; 3/6/12 controls set the visible range.
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

## Payment reminders

Set an optional day of the month on an entry, then enable reminders for expenses. Choose 0–365 days before the due date, a local time, and optionally another reminder on the due date. Short months use their last day. Old entries remain undated. Paid status is informational and does not change monthly forecast totals. A v3 backup preserves dates, reminders and paid months; previous backups remain readable, but v3 backups cannot be opened in older app versions.

On Android, explicitly enable notifications in the payments section and grant the OS permission. The schedule is local, uses native alarms, and does not need a server or Internet access. Enabling applies to all accounts. Saving, marking paid, editing, deleting, importing or disabling reminders replaces/cancels the pending schedule. Native scheduling only uses successfully saved budgets. A test-notification button is available. Exact alarm access is optional; without it, Android can delay delivery. Battery restrictions and force-stop can also affect delivery. Lock-screen notification content is private by default; Android settings may override this.

Up to one year and 256 notification groups are scheduled; same-minute payments share one notification. Open the app to renew the schedule and after changing time zones. The UI reports its coverage. Windows reminders are an in-app payment list, with no background service. This release does not implement daily running balances or a full calendar grid.

## Build

Node 22+ is required for development.

```sh
npm ci
npm test
npm run build
```

Windows: `npm run package:windows` builds the NSIS installer. Use `npm run desktop` for a desktop development run after building the interface. Icons are included; regenerate them with `python scripts/generate-icons.py` (Pillow required).

Android: Java 21 and Android SDK platform 36/build-tools 36.0.0 are required. Run `npm run sync:mobile`, then `cd android` and `./gradlew assembleRelease` (`gradlew.bat assembleRelease` on Windows). The release APK must be signed using a private keystore kept outside version control. The CI workflow produces a clearly labelled development APK, not a store release.

The earlier iOS scaffold remains in source history but is outside the supported release scope.

The app's HTML/CSS interface is rendered inside a native application shell; it does not load a hosted website.

## Validation and distribution

All 62 Vitest tests and the TypeScript/Vite production build passed. The packaged Windows application was checked with an isolated local profile: account currencies, exchange creation/editing/direction/deletion, forecast balances, persistence after restarting, RU/EN, native backup export/import, mobile-width layout and blocking outbound requests. Android's release build passed; its APK signature and packaged permissions were checked. Version 1.3 checks cover optional payment days, short-month dates, reminder settings, paid/undo, v2 migration and restart persistence. Physical Android testing has not been performed.

Windows is distributed as an unsigned NSIS installer (no publisher certificate). Android is distributed as an APK signed with the application's private release key, for installation directly on an Android 7+ device. It requests no Internet permission. iPhone is not a supported release target.

## По-русски

У каждого счёта своя валюта. Для обмена выберите счёт списания и счёт зачисления, затем введите обе суммы. Можно поменять направление. Программа рассчитывает курс по вашим значениям и меняет прогноз обоих счетов; доходы и расходы при этом не увеличиваются.

На телефоне приложение работает самостоятельно, с локальными данными. Сервер на ПК и подключение к нему не требуются.
