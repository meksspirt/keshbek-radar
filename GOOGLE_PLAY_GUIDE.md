# КешбекРадар — Повний пакет для публікації в Google Play Console

Цей документ містить усе необхідне для релізу Android-застосунку **КешбекРадар (`ua.cashbackradar.app`)** у Google Play Console: готові білди, графіку, тексти сторінки магазину, точні відповіді на всі анкети (Data Safety, Financial Features, IARC, App Access), шаблон Політики конфіденційності та звіт із безпеки Android.

---

## 1. Готові файли релізу та графіка

Усі файли згенеровані та зібрані в папці [`google-play-release/`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release):

| Призначення | Шлях до файлу | Формат / Розмір |
|---|---|---|
| **Android App Bundle (для Google Play)** | [`google-play-release/cashback-radar-ua-v1.0.0-release.aab`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/cashback-radar-ua-v1.0.0-release.aab) | Signed Release `.aab` (targetSdk 36, R8) |
| **Release APK (для прямого встановлення)** | [`google-play-release/cashback-radar-ua-v1.0.0-release.apk`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/cashback-radar-ua-v1.0.0-release.apk) | Signed Release `.apk` |
| **Debug APK (для тестування)** | [`google-play-release/cashback-radar-ua-v1.0.0-debug.apk`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/cashback-radar-ua-v1.0.0-debug.apk) | Debug `.apk` |
| **Іконка додатка (App Icon)** | [`google-play-release/assets/icon-512x512.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/icon-512x512.png) | `512 × 512 px` PNG |
| **Банер для Google Play (Feature Graphic)** | [`google-play-release/assets/feature-graphic-1024x500.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/feature-graphic-1024x500.png) | `1024 × 500 px` PNG |
| **Бренд-борд 3×3 (Brand Kit)** | [`google-play-release/assets/brandkit-board-1600x1200.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/brandkit-board-1600x1200.png) | `1600 × 1200 px` PNG |
| **Скріншот 1 — Пошук та перемога #1** | [`google-play-release/assets/screenshots/01-radar-search.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/screenshots/01-radar-search.png) | `1080 × 1920 px` (9:16) |
| **Скріншот 2 — Чистий кешбек −23%** | [`google-play-release/assets/screenshots/02-net-vs-gross-tax.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/screenshots/02-net-vs-gross-tax.png) | `1080 × 1920 px` (9:16) |
| **Скріншот 3 — 21 банк у гаманці** | [`google-play-release/assets/screenshots/03-wallet-21-banks.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/screenshots/03-wallet-21-banks.png) | `1080 × 1920 px` (9:16) |
| **Скріншот 4 — Довідник MCC та приватність** | [`google-play-release/assets/screenshots/04-catalog-mcc.png`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/assets/screenshots/04-catalog-mcc.png) | `1080 × 1920 px` (9:16) |

> **ВАЖЛИВО щодо ключа підпису (Upload Keystore):**
> Ключ підпису збережено локально у [`android/keystore/cashbackradar-release.jks`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/android/keystore/cashbackradar-release.jks), а паролі до нього — у [`android/keystore.properties`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/android/keystore.properties) (обидва додано до `.gitignore` і не потрапляють у Git). **Обов'язково зробіть резервну копію цих двох файлів** у безпечному хмарному сховищі або менеджері паролів — без них неможливо підписати наступні оновлення без запиту на скидання ключа в Google Play!

---

## 2. Готові тексти для сторінки Google Play (Store Listing)

### 🇺🇦 Українська (`uk-UA` — основна мова за замовчуванням)

* **Назва додатка (App name, ліміт 30 символів — використано 27):**
  ```text
  КешбекРадар — Вибір картки
  ```

* **Короткий опис (Short description, ліміт 80 символів — використано 74):**
  ```text
  Найвигідніша українська картка за 2 с: власні чи кредитні та податок -23%.
  ```

* **Повний опис (Full description, ліміт 4000 символів):**
  ```text
  КешбекРадар — це розумний фінансовий помічник для власників карток українських банків. Дізнайтеся за 2 секунди прямо біля каси, якою карткою та якими коштами (власними чи кредитними) вигідніше оплатити покупку просто зараз.

  НАВІЩО ПОТРІБЕН КЕШБЕКРАДАР?
  Коли у гаманці 3–6 карток різних банків України, запам'ятати щомісячні категорії та умови неможливо. У багатьох банків ставка за кредитні кошти та за власні кошти відрізняється у 2–4 рази, а частина банків утримує 23% державних податків (18% ПДФО + 5% військовий збір), тоді як бонусні програми нараховують бали без податку.

  КешбекРадар зводить усі ваші правила в один миттєвий рейтинг.

  КЛЮЧОВІ МОЖЛИВОСТІ:
  • Пошук за магазином або категорією за 2 секунди — введіть «АТБ», «Сільпо», «Аврора», «ОККО», «Rozetka», «АНЦ», «Епіцентр», «ChatGPT» або MCC-код, і застосунок одразу визначить категорію.
  • Окремий розрахунок «Власні vs Кредитні» — побачте точну різницю у відсотках і гривнях між оплатою з дебетового залишку та з кредитного ліміту.
  • Реальний чистий кешбек «на руки» — автоматичне врахування 23% податку (18% ПДФО + 5% військовий збір = множник 0.77) та перемикач на номінальний (брудний) режим.
  • 21 український банк у каталозі — monobank, ПриватБанк, ПУМБ, Сенс Банк, àбанк, Глобус Банк, izibank, ТАСкомбанк, Райффайзен Банк, Юнекс Банк, Акордбанк, Кристалбанк, Бізбанк, Банк Альянс, Кредит Дніпро, Радабанк, ВСТ Банк, МТБ Банк, Український капітал, Ідея Банк, Банк КД.
  • 25 канонічних категорій і довідник MCC-кодів — продукти, АЗС, аптеки, кафе, мультимаркети, маркетплейси, транспорт, книги, ШІ-сервіси, «Кешбек на усі покупки» (фолбек) тощо.
  • Швидке оновлення ставок на місяць — налаштуйте обрані категорії 1-го числа за хвилину й користуйтеся весь місяць.
  • Конфіденційність без компромісів — додаток НЕ вимагає підключення до банкінгу, номерів карток, CVV, PIN-кодів чи SMS. Ви самі вводите лише назву картки та відсотки кешбеку.

  ПОВНИЙ КОНТРОЛЬ І БЕЗПЕКА:
  • Жодних банківських логінів чи Open Banking токенів.
  • Не зберігає і не обробляє реальні номери карток або транзакції.
  • Усі дані користувача ізольовані.

  Плануйте покупки розумно та отримуйте максимум чистої вигоди з кожної гривні разом із КешбекРадар!
  ```

---

### 🇬🇧 English (`en-US` — для міжнародних модераторів Google та англомовної аудиторії)

* **App name (30/30 chars):**
  ```text
  CashbackRadar UA — Card Picker
  ```

* **Short description (71/80 chars):**
  ```text
  Pick the best Ukrainian card in 2s: own vs credit funds & 23% tax math.
  ```

* **Full description:**
  ```text
  CashbackRadar UA helps cardholders in Ukraine choose the most rewarding payment card in 2 seconds right at checkout.

  KEY FEATURES:
  • Instant merchant & MCC lookup — search Ukrainian stores (ATB, Silpo, Avrora, OKKO, Rozetka, Epicentr, ANC, ChatGPT) or any of 25 spending categories to see your #1 card immediately.
  • Own vs. Credit Funds comparison — track separate cashback percentages for personal debit balance and credit limit funds on every card.
  • Net Cashback after Ukrainian Taxes — automatically calculates your real take-home cashback after 23% tax (18% PIT + 5% military levy), with a quick toggle to gross rates.
  • 21 Ukrainian Banks supported — monobank, PrivatBank, PUMB, Sense Bank, a-bank, Globus Bank, izibank, TAScombank, Raiffeisen Bank, Unex Bank, Accordbank, and more.
  • Privacy-first by design — CashbackRadar is a standalone personal calculator and reference guide. It NEVER asks for card numbers, CVV, bank logins, or Open Banking access.
  ```

---

### 🇷🇺 Русский (`ru-RU` — опционально, если планируете добавлять локализацию)

* **Название (25/30 символов):**
  ```text
  КешбекРадар — Выбор карты
  ```

* **Краткое описание (70/80 символов):**
  ```text
  Лучшая карта Украины за 2 с: свои или кредитные средства и налог -23%.
  ```

---

## 3. Покрокова шпаргалка: як заповнити всі розділи Google Play Console

### Крок А. Створення додатка та базові налаштування (Dashboard → Store settings)
1. **Create app**:
   * **App name**: `КешбекРадар — Вибір картки`
   * **Default language**: `Ukrainian (uk)` (`Українська`)
   * **App or game**: `App`
   * **Free or paid**: `Free`
2. **Store settings (Налаштування магазину)**:
   * **App category**: `Finance` (`Фінанси`)
   * **Tags**: виберіть `Finance`, `Personal finance`, `Shopping` / `Tools` (до 5 тегів)
   * **Store listing contact details**: вкажіть ваш публічний email підтримки (наприклад `support@cashbackradar.ua` або робочий Gmail — він буде видимим на сторінці в Google Play).

---

### Крок Б. Політика конфіденційності (App content → Privacy policy)

Google Play **обов'язково вимагає** публічне HTTPS-посилання (URL) на Політику конфіденційності (її можна розмістити на вашому домені Vercel, наприклад `https://your-domain.vercel.app/privacy`, або на GitHub Pages / Notion). Нижче готовий текст, який повністю відповідає коду вашого додатка:

> **Політика конфіденційності застосунку «КешбекРадар» (`ua.cashbackradar.app`)**
> Останнє оновлення: листопад 2026 року
>
> 1. **Загальні положення**
> Застосунок «КешбекРадар» є персональним довідником і калькулятором вигідності кешбеку банківських карток. Застосунок не є банком, не надає платіжних або кредитних послуг і не запитує номери банківських карток, CVV-коди, PIN-коди чи паролі від онлайн-банкінгу.
>
> 2. **Які дані ми збираємо та зберігаємо**
> * *У локальному режимі (за замовчуванням у поточній збірці)*: дані профілю, обрані назви банків/карток та відсотки кешбеку зберігаються локально лише на вашому пристрої (WebView localStorage) і не передаються розробнику.
> * *У хмарному режимі (при підключенні синхронізації через Supabase)*: електронна адреса, ім'я учасника та ваші налаштовані правила кешбеку зберігаються в захищеній базі даних із шифруванням передачі даних (HTTPS/TLS) та суворою ізоляцією доступу Row Level Security (`auth.uid()`).
>
> 3. **Передача даних третім особам**
> Ми не продаємо, не передаємо та не розкриваємо ваші персональні дані третім особам чи рекламним мережам. У застосунку відсутня реклама.
>
> 4. **Видалення акаунта та даних**
> Користувач може в будь-який момент видалити локальні дані через налаштування пристрою/додатка, або запросити повне видалення хмарного акаунта та пов'язаних даних, звернувшись на електронну адресу підтримки: `[ваш-email@example.com]`.
>
> 5. **Контакти**
> З усіх питань конфіденційності звертайтеся: `[ваш-email@example.com]`.

---

### Крок В. Анкета App Access (Доступ до додатка для модераторів Google)

Оскільки в додатку є екран входу (`AuthScreen.tsx`), Google Play зобов'язує заповнити **App content → App access**:
* Оберіть: **"All or some functionality in my app is restricted"** *(Частина функцій доступна після входу)*.
* Натисніть **Add new instructions** і вставте:

  *Якщо ви публікуєте поточний локальний білд (без підключеного Supabase у `.env`):*
  * **Name**: `Demo Wallet Access (No password required)`
  * **Username / Phone**: `demo@cashbackradar.ua` (або залиште примітку)
  * **Password**: `Demo1234!` *(лише для поля форми, нижче вкажіть інструкцію)*
  * **Any other instructions**:
    ```text
    The app works in local isolated mode and does NOT require real bank credentials.
    To review all features immediately without registration:
    1. Scroll down to the login card ("Вхід у персональний кабінет") or tap "Вхід у кабінет".
    2. Tap the button "Швидкий демо-вхід (4 українські картки)" at the bottom of the login form.
    3. You will enter the main app with 4 pre-configured sample cards across Ukrainian banks, where you can test Radar search, Own vs Credit calculation, Net/Gross 23% tax mode, Wallet editing, and the MCC Catalog.
    ```

  *(Примітка: якщо перед релізом ви додасте ключі Supabase у `.env`, кнопка демо-входу приховується — тоді заздалегідь створіть тестовий акаунт, наприклад `reviewer@cashbackradar.ua`, і впишіть його логін і пароль у ці поля!)*

---

### Крок Г. Анкета Data Safety (Безпека даних)

> **УВАГА:** Заповнюйте відповідно до того, чи підключений у білді хмарний Supabase (`.env`).
> У **поточному зібраному `.aab`** (без `.env` ключів Supabase) усі дані користувача зберігаються **виключно локально на пристрої**, сторонні аналітичні SDK та реклама відсутні, мережеві дані на сервер розробника не відправляються!

**Варіант 1 — Для поточного локального білда (без `.env` Supabase):**
1. *Does your app collect or share any of the required user data types?* → **No** *(дані не залишають пристрій користувача; локальне зберігання в `localStorage` без передачі на сервер за правилами Google Play не вважається «Data Collection»)*.
2. *Is all of the user data collected by your app encrypted in transit?* → **Yes** *(весь мережевий трафік додатково захищено `usesCleartextTraffic="false"` та `network_security_config.xml`)*.

**Варіант 2 — Якщо ви зберете новий білд із підключеним Supabase (`.env`):**
1. *Does your app collect or share any of the required user data types?* → **Yes**
2. *Is all user data encrypted in transit?* → **Yes**
3. *Do you provide a way for users to request that their data is deleted?* → **Yes** *(та вкажіть URL сторінки видалення / інструкцію, або вбудуйте функцію видалення в додатку)*
4. **Data types**:
   * **Personal info → Name** (Collected: Yes, Shared: No, Ephemeral: No, Required: Optional, Purpose: App functionality, Account management)
   * **Personal info → Email address** (Collected: Yes, Shared: No, Ephemeral: No, Required: Required, Purpose: App functionality, Account management)
   * **App activity / User generated preferences** (App info/other user-generated content — обрані назви карток без номерів та налаштовані % кешбеку: Collected: Yes, Shared: No, Purpose: App functionality)
   * **Financial info (Bank card numbers, payments, credit score)**: **НЕ позначати (No)** — додаток не збирає номери карток, банківські рахунки чи платіжні транзакції!

---

### Крок Д. Financial Features Declaration (Декларація фінансових функцій)

У категорії **Finance** Google Play обов'язково покаже анкету **Financial features** (кредити, криптовалюта, банкінг, страхування, інвестиції).
* На першому екрані списку фінансових продуктів оберіть:
  **"My app doesn't provide any financial products or services"** *(Мій додаток не надає жодних фінансових продуктів чи послуг — це персональний калькулятор і довідник кешбеку)*.
* Якщо система попросить коротке пояснення:
  ```text
  CashbackRadar UA is an informational cashback calculator and personal rate tracker. It does not issue loans or credit cards, does not process payments, does not connect to bank accounts or Open Banking APIs, and does not collect card numbers, CVVs, or financial credentials.
  ```

---

### Крок Е. Інші обов'язкові анкети (App content)

| Анкета | Що обрати |
|---|---|
| **Ads (Реклама)** | `No, my app does not contain ads` |
| **Content rating (IARC)** | Категорія: `Utility, Productivity, Communication, or Other`. На всі питання про насильство, азартні ігри, контент 18+, нецензурну лексику, передачу геолокації іншим користувачам та покупки всередині додатка оберіть **`No`**. Результат: **PEGI 3 / Everyone**. |
| **Target audience and content** | Оберіть вікові групи **`18 and over`** *(або `13–15`, `16–17`, `18+`)* — **НЕ обирайте** дітей до 13 років, щоб уникнути тривалої перевірки Designed for Families! |
| **News apps** | `No` |
| **COVID-19 contact tracing / status** | `My app is not a publicly available COVID-19 contact tracing or status app` |
| **Data safety / Government apps** | `No` |
| **Advertising ID** | `No` *(у `AndroidManifest.xml` немає `AD_ID`)* |

---

### Крок Є. Завантаження `.aab` та випуск релізу

1. У лівому меню Google Play Console відкрийте:
   * Якщо у вас **новий особистий акаунт розробника** (створений після листопада 2023): спочатку відкрийте **Testing → Closed testing (Закрите тестування)** → створіть трек, завантажте [`cashback-radar-ua-v1.0.0-release.aab`](file:///c:/Users/Mlyub/Desktop/Project/КешбекРадар/google-play-release/cashback-radar-ua-v1.0.0-release.aab), запросіть 12 тестувальників на 14 днів, після чого стане доступною кнопка **Apply for production**.
   * Якщо у вас **акаунт організації (Organization)** або вже схвалений продакшн: відкрийте **Release → Production → Create new release**.
2. На етапі **App integrity (Play App Signing)**: натисніть **Choose signing key → Use Google-generated key** *(Google Play сам керуватиме ключем розповсюдження, а ваш локальний `cashbackradar-release.jks` слугуватиме Upload Key для підтвердження нових версій)*.
3. Перетягніть файл `google-play-release/cashback-radar-ua-v1.0.0-release.aab`.
4. Заповніть **Release notes** (`uk-UA`):
   ```text
   Перший реліз КешбекРадар для Android:
   • Миттєвий пошук найвигіднішої картки серед 21 українського банку
   • Порівняння ставок за власні та кредитні кошти
   • Автоматичний розрахунок чистого кешбеку після 23% податку (18% ПДФО + 5% ВЗ)
   • Каталог із 25 категорій витрат та довідник MCC-кодів
   ```
5. Натисніть **Next → Save → Send for review**.

---

## 4. Best Practices and Security Alignment Update Report

Нижче зафіксовано всі налаштування безпеки, сумісності та оптимізації Android, реалізовані за стандартами скілів проєкту:

### Best practices and security alignment update: Edge-to-Edge, Target SDK 36 & Safe Area
* **Improvement Description:** Налаштовано нативний режим Edge-to-Edge (`targetSdkVersion = 36`, `compileSdkVersion = 36`), темні системні бари (`#09090B`), вимкнено примусове системне затемнення панелі навігації (`setNavigationBarContrastEnforced(false)` на API 29+), додано `adjustResize` для коректної роботи клавіатури (IME) та нижній `safe-area-inset-bottom` у CSS.
* **Priority Level:** High
* **Alignment Action:** Інтегровано `EdgeToEdge.enable(...)` та `WindowInsetsControllerCompat` у `MainActivity.java`; додано `android:windowSoftInputMode="adjustResize"` у `AndroidManifest.xml`; оновлено `src/index.css` та `android/variables.gradle`.
* **Files modified:** `android/app/src/main/java/ua/cashbackradar/app/MainActivity.java`, `android/app/src/main/AndroidManifest.xml`, `android/variables.gradle`, `android/app/src/main/res/values/styles.xml`, `android/app/src/main/res/values/colors.xml`, `src/index.css`.

### Best practices and security alignment update: Android Intent & Permissions Hardening
* **Improvement Description:** Застосовано принцип мінімальних привілеїв (тільки дозвіл `INTERNET`), заборонено незахищений HTTP-трафік (`usesCleartextTraffic="false"` + `network_security_config.xml`), вимкнено резервне копіювання даних (`allowBackup="false"`), обмежено шляхи `FileProvider` до підкаталогів `shared/` (без wildcard `path="."`), та додано санітизацію вхідних `Intent` у `onCreate` і `onNewIntent` (зняття прапорів URI-дозволів, очищення `selector` та вкладеного `EXTRA_INTENT`).
* **Priority Level:** High
* **Alignment Action:** Посилено конфігурацію `AndroidManifest.xml`, `res/xml/file_paths.xml`, створено `res/xml/network_security_config.xml`, реалізовано `sanitizeIncomingIntent` у `MainActivity.java`.
* **Files modified:** `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/xml/file_paths.xml`, `android/app/src/main/res/xml/network_security_config.xml`, `android/app/src/main/java/ua/cashbackradar/app/MainActivity.java`.

### Best practices and security alignment update: R8 Full-Mode Shrinking & Release Signing
* **Improvement Description:** Увімкнено оптимізацію коду та ресурсів R8 у release-білді (`minifyEnabled true`, `shrinkResources true`, `proguard-android-optimize.txt`) із точковими правилами збереження для Capacitor `@JavascriptInterface` і `MainActivity` без широких wildcard-правил, а також налаштовано підпис upload-ключем RSA-2048.
* **Priority Level:** Medium
* **Alignment Action:** Налаштовано `signingConfigs.release` і `buildTypes.release` в `android/app/build.gradle`, оновлено `android/app/proguard-rules.pro`.
* **Files modified:** `android/app/build.gradle`, `android/app/proguard-rules.pro`, `.gitignore`.
