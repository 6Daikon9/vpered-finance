# Vpered 1.1.0 / Вперёд

Автономный калькулятор бюджета с русским и английским интерфейсом.

- Счета в 13 валютах, одна валюта на счёт.
- Доходы и расходы по категориям: ежемесячные, разовые и с последним месяцем выплаты.
- Прогноз остатков на 3, 6 и 12 месяцев отдельно по каждому счёту.
- Обмен валют и переводы: введите, сколько списано с одного счёта и сколько получено на другом. Курс считается по вашим суммам; направление можно поменять.
- Одна запись обмена меняет оба счёта. Изменение и удаление пересчитывают оба прогноза. Переводы не увеличивают доходы или расходы.
- Локальное сохранение и перенос бюджета через JSON-файл.

## Installation / Установка

- **Windows x64:** `Vpered-Setup-1.1.0.exe`. Установщик без сертификата издателя; Windows может показать предупреждение о неизвестном приложении.
- **Android 7+:** `Vpered-1.1.0-Android.apk`. Откройте файл на телефоне и разрешите установку из выбранного источника. APK подписан ключом приложения. После установки ПК и интернет не требуются.
- **iPhone:** исходный проект включён. Готового IPA нет: необходимы сборка на Mac и подпись Apple.

## Checks / Проверки

32 Vitest tests, TypeScript/Vite production build, packaged Windows runtime checks (currencies, transfers, persistence, RU/EN, mobile layout, outbound network blocking), Android release build and APK signature/permission verification. Physical phone testing has not been performed.

Personal budgets, signing keys, passwords and SDK/build caches are excluded from source and release assets. Backups exported by the user are unencrypted. Separate devices keep separate data.
