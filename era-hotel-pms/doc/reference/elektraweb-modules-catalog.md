# Elektraweb — полный каталог модулей для клонирования (Nafta)

> **Цель:** детальные описания всех модулей Elektraweb для разработки собственного PMS/ERP.
> **Контекст:** Nafta уже использует Elektraweb (~5000 EUR/год) и переходит на свой продукт с возможностью перепродажи.
> **Дата:** 20 мая 2026

---

## Содержание

1. [Архитектура платформы](#1-архитектура-платформы)
2. [Otel / PMS — маркетинговые модули](#2-otel--pms--маркетинговые-модули)
3. [PMS Ön Büro — подмодули ядра](#3-pms-ön-büro--подмодули-ядра)
4. [POS](#4-pos)
5. [ERP](#5-erp)
6. [Diğer решения](#6-diğer-решения)
7. [Интеграции и API](#7-интеграции-и-api)
8. [Мобильные приложения](#8-мобильные-приложения)
9. [Kalite Yönetimi (QM) — подмодули](#9-kalite-yönetimi-qm--подмодули)
10. [Служебные SKU и hardware](#10-служебные-sku-и-hardware)
11. [Полный реестр API (174 SKU)](#11-полный-реестр-api-174-sku)
12. [Приоритеты клонирования для Nafta](#12-приоритеты-клонирования-для-nafta)

Скриншоты: папка `doc/screenshots/elektraweb/` (~100+ изображений с маркетинговых страниц).

---

## 1. Архитектура платформы

| Компонент | Описание |
|-----------|----------|
| **app.elektraweb.com** | Рабочее облачное приложение (PMS) |
| **teklifapp / priceapi** | Конфигуратор лицензий (Angular + REST) |
| **yardim.elektraweb.com** | Документация пользователя |
| **operator.elektraweb.com** | Мобильное приложение Operator |
| **Мультитенантность** | Один инстанс — много отелей (типичная SaaS-модель) |
| **Стек (публично)** | Web-based, cloud, WordPress-маркетинг + отдельное SPA |

**Связи модулей:** PMS — центр; POS/Stok/Muhasebe постят в folio; Channel Manager пишет резервации; CRM/Call Center читают профиль гостя; Mobile apps — тонкие клиенты к API.

---

## 2. Otel / PMS — маркетинговые модули

### 1. Ön Büro Modülü

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `PMS` |
| **Product ID** | 5 |
| **Страница** | [on-buro](https://www.elektraweb.com/on-buro/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-pms/index.html) |

**Назначение:** Efficiently handles front office operations, reservations, housekeeping, folios, billing, online sales, identity reporting, and management analytics.

#### Функциональные блоки (с сайта)

**Ön Büro Programı** — Elektraweb Web Tabanlı Otel Programı Ön büro modülü ile rezervasyon, resepsiyon, housekeeping, fatura, folyo, channel manager, online rezervasyon, emniyet kimlik bildirimi gibi işlemleri rahatlıkla gerçekleştirebilir, ayrıntılı yönetim raporlarına tek tuşla ulaşabilirsiniz.

**Günlük Durum Ekranı** — Elektraweb Otel Yönetim Sistemi, "Günlük Durum Ekranı" ile doluluk, gelir, forecast, konaklayanlar, rezervasyonlar ilgili bilgiler ve hatta çağrı merkezi notları gibi otel hakkındaki tüm önemli ve kritik bilgileri tek bir ekranda sunar.

#### Скриншоты / визуалы

![on-buro-1](screenshots/elektraweb/on-buro-1.png)

![on-buro-2](screenshots/elektraweb/on-buro-2.jpg)

![on-buro-3](screenshots/elektraweb/on-buro-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 2. Kanal Yönetimi

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `ChannelManager&BookingEngine` |
| **Product ID** | 272 |
| **Страница** | [kanal-yonetimi](https://www.elektraweb.com/kanal-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-channel-manager/index.html) |

**Назначение:** Synchronizes availability, rates, and reservations with online channels in real time, supports stop sale automation, and enables direct bookings through the hotel’s website via the integrated online booking engine.

#### Функциональные блоки (с сайта)

**Kanal Yönetimi** — ElektraWeb, yalnızca çevrimiçi kanalları (Booking.com, Expedia, Hotelbeds, HotelsPro vb.) Senkronize etmekle kalmayan, aynı zamanda oteldeki rezervasyonları alan entegre bir kanal yöneticisine sahiptir. Bu yüzden çok daha kolay ve daha etkilidir.

#### Скриншоты / визуалы

![kanal-yonetimi-1](screenshots/elektraweb/kanal-yonetimi-1.jpg)

![kanal-yonetimi-2](screenshots/elektraweb/kanal-yonetimi-2.jpg)

![kanal-yonetimi-3](screenshots/elektraweb/kanal-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 3. Online Rezervasyon Motoru

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `ChannelManager&BookingEngine` |
| **Product ID** | 272 |
| **Страница** | [online-rezervasyon-motoru](https://www.elektraweb.com/online-rezervasyon-motoru/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-channel-manager/index.html) |

**Назначение:** Synchronizes availability, rates, and reservations with online channels in real time, supports stop sale automation, and enables direct bookings through the hotel’s website via the integrated online booking engine.

#### Функциональные блоки (с сайта)

**Online Rezervasyon Motoru** — Elektraweb, online rezervasyon, kanal yönetimi , fiyat yönetimi, Çağrı Merkezi , satış takip modülleriyle bütünleşik satış yönetimi sağlar

- ElektraWeb, otel misafirleri ve seyahat acentelerine yönelik, webde ve mobil olarak kullanılabilen, ön büroya entegre edilmiş bir online rezervasyon motoruna sahiptir. Grup ve zincir otellerde, merkezi rezervasyon sistemi(CRS), online rezervasyon motoru olarak kullanılabilir.

#### Скриншоты / визуалы

![online-rezervasyon-motoru-1](screenshots/elektraweb/online-rezervasyon-motoru-1.png)

![online-rezervasyon-motoru-2](screenshots/elektraweb/online-rezervasyon-motoru-2.png)

![online-rezervasyon-motoru-3](screenshots/elektraweb/online-rezervasyon-motoru-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 4. Satış ve Banket Yönetimi

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `SalesMarketing` |
| **Product ID** | 8 |
| **Страница** | [satis-projeleri-ve-banket-yonetimi](https://www.elektraweb.com/satis-projeleri-ve-banket-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-operation/eptera-sales-marketing/index.html) |

**Назначение:** Manages events, groups, weddings, and banquets with resource booking, staff calendars, and equipment availability.

#### Функциональные блоки (с сайта)

**Satış Projeleri ve Banket Yönetimi** — Elektraweb Satış Projeleri ve Banket Yönetimi ile, tüm satış projelerinizi tek ekrandan izleyebilirsiniz.

- Salon ve menü organizasyonları
- Kontrat yönetimi
- Teklif hazırlama

#### Скриншоты / визуалы

![satis-projeleri-ve-banket-yonetimi-1](screenshots/elektraweb/satis-projeleri-ve-banket-yonetimi-1.jpg)

![satis-projeleri-ve-banket-yonetimi-2](screenshots/elektraweb/satis-projeleri-ve-banket-yonetimi-2.png)

![satis-projeleri-ve-banket-yonetimi-3](screenshots/elektraweb/satis-projeleri-ve-banket-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 5. Acente Bonus

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `AgencyLoyaltyModule+BookingPortal` |
| **Product ID** | 295 |
| **Страница** | [acente-bonus](https://www.elektraweb.com/acente-bonus/) |

#### Функциональные блоки (с сайта)

**Elektra Acente Bonus Sisteminin Avantajları​** — Hızlı Entegrasyon : Acentelerin kullanacağı ön rezervasyon ekranı için ayrıca kontenjan veya fiyat girişi yapmanıza gerek yoktur. Elektra sisteminde tanımlı olan bilgiler otomatik olarak kullanılır. Acenteler kayıt olup onaylandıklarında hemen çalışmaya başlayabilirler.​

- Acenteler rezervasyon girişi yapabilir,
- Otel ile çevrimiçi iletişim kurabilir,
- Rezervasyon iptali ve değişiklik taleplerini iletebilir,
- Check-in ve check-out tamamlandığında ne kadar bonus kazandıklarını görüntüleyebilirler

**Neden Elektra Acenta Bonus Sistemi Daha Avantajlı ?** — Tam entegrasyon : Elektra Acente Sadakat Sistemi, Elektra Otel Yönetim Sistemi (PMS) ile %100 entegre çalışır; ayrı bir yazılım veya manuel veri aktarımı gerektirmez.​

#### Скриншоты / визуалы

![acente-bonus-1](screenshots/elektraweb/acente-bonus-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 6. Tur Operatörü Entegrasyonu

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `TOY` |
| **Product ID** | 252 |
| **Страница** | [tur-operatoru-entegrasyonu](https://www.elektraweb.com/tur-operatoru-entegrasyonu/) |

**Назначение:** Transfers bookings directly from offline agency extranets into the PMS with controlled data validation.

#### Функциональные блоки (с сайта)

**Operatör entegrasyonunun size kazandırdıkları** — Manuel girişleri ortadan kaldırın, hatalı fiyatları yakalayın ve onay süreçlerini saatlerden saniyelere indirin.

**Konnektörü iş başında görün** — Tarama programı, operatör panellerindeki rezervasyonları otomatik olarak ElektraWeb Operatör Rezervasyon ekranına aktarır. Manuel kontrol bitti.

**40+ tur operatörü ile hazır entegrasyon** — Doğrudan API entegrasyonu olan operatörlerin yanı sıra, 25+ operatör ile e-posta kanalı üzerinden de rezervasyon entegrasyonu sağlanır.

**Mobil yönetim ile her yerden tam kontrol** — Operatör rezervasyon süreçlerinizi cebinizden yönetin. Onay süreçleri artık masa başına bağlı değil.

**Operatör süreçlerinizi otomatikleştirmeye bugün başlayın** — Elektraweb uzmanları tesisinizin ihtiyaçlarına özel bir demo ile entegrasyon sürecini birlikte tamamlayalım.

#### Скриншоты / визуалы

![tur-operatoru-entegrasyonu-1](screenshots/elektraweb/tur-operatoru-entegrasyonu-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 7. Kimlikokur

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `ID&PassportScanner` |
| **Product ID** | 32 |
| **Страница** | [kimlikokur-kimlik-ve-pasaport-okuma](https://www.elektraweb.com/kimlikokur-kimlik-ve-pasaport-okuma/) |

**Назначение:** Eptera ID & Passport Scanner scans passports and ID cards, saves them as image and text, and transfers the extracted details directly into the PMS or any Windows based application.

#### Функциональные блоки (с сайта)

**Kimlikokur Kimlik ve Pasaport Okuma Programı** — Kimlikokur , dünyadaki tüm kimlik ve pasaportları okuyup tanıyabilen, resim ve metin olarak saklayıp, windows ortamındaki tüm programlara aktarabilen bir yazılımdır.

#### Скриншоты / визуалы

![kimlikokur-kimlik-ve-pasaport-okuma-1](screenshots/elektraweb/kimlikokur-kimlik-ve-pasaport-okuma-1.jpg)

![kimlikokur-kimlik-ve-pasaport-okuma-2](screenshots/elektraweb/kimlikokur-kimlik-ve-pasaport-okuma-2.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 8. Hotspot ve Loglama

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `HotspotHotel` |
| **Product ID** | 255 |
| **Страница** | [hotspot-internet-guvenlik-ve-loglama-sistemi](https://www.elektraweb.com/hotspot-internet-guvenlik-ve-loglama-sistemi/) |

**Назначение:** İlk Yıl Tek seferlik Kurulum ücreti eklenir

#### Функциональные блоки (с сайта)

**Hotspot İnternet Güvenlik ve Loglama Sistemi** — 5651 sayılı yasa ile internet kullanılan yerlerde kullanıma ait trafik bilgilerinin zaman (hash) damgası ile birlikte saklanması ve gizliliğinin sağlanması zorunlu hale getirilmiştir. Elektraweb , internet verilerinin 5651 nolu yasa da belirtildiği şekilde muhafazasını ve gizliliğini sağlayan, yazılım + donanım olarak sunulan bir çözüme ahiptir .

- 13 dilde tasarım, otomatik misafirin diline göre karşılama,
- Geçici bağlantı özelliği,
- Ücretli-Ücretsiz Internet Bağlantısı, Oda hesabına yazma, raporlama,
- Kişiselleştirilebilir hotspot ayarları,
- Oda numarası, Toplantı grubu, Konferans Kodu, Personel girişi ve SMS ile Bağlantı,
- Tüm Otel yazılımları ile entegre yapı,
- Tüm personel programları ile entegre
- Bağlanan kullanıcıya göre ayrı ayrı hız tanımlama,
- Kullanıcıya kullanım süresi tanımlama,
- Reklam modülü; + Her bağlantı tipine göre ayrı ayrı reklam gösterebilme + Giriş yapan kullanıcının diline göre ayrı ayrı reklam gösterebilme + Çalışan personele duyuru ve bilgilendirme gösterebilme + Toplantı gruplarına özel reklam ve duyuru gösterebilme,
- Otomatik kara liste özelliği ile yetkisiz girişleri engelleme
- Yoğun girişlerde "Autologin" özelliği ile şifresiz bağlantıları
- Otel yoğunluk haritası
- Misafir ayak izi vb. durum raporlama
- 7/24 stabil çalışma ve kararlılık

#### Скриншоты / визуалы

![hotspot-internet-guvenlik-ve-loglama-sistemi-1](screenshots/elektraweb/hotspot-internet-guvenlik-ve-loglama-sistemi-1.jpg)

![hotspot-internet-guvenlik-ve-loglama-sistemi-2](screenshots/elektraweb/hotspot-internet-guvenlik-ve-loglama-sistemi-2.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 9. Çağrı Merkezi

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `CALL` |
| **Product ID** | 10 |
| **Страница** | [cagri-merkezi-programi](https://www.elektraweb.com/cagri-merkezi-programi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-operation/eptera-call-center/index.html) |

**Назначение:** Supports centralized reservation handling with CRM insights that automatically display caller details during the call.

#### Функциональные блоки (с сайта)

**Çağrı Merkezi Programı** — Elektraweb Çağrı Merkezi Çözümleri sayesinde, telefon, whatsapp, web sayfası ve sosyal medya üzerinden sizinle iletişim kuran tüm müşterilerinizin çağrılarını ortak bir platformda toplayabilir, ekibinizin onlarla iletişime geçerek bilgilendirme yapmasını ve özel talepleri almalarını sağlayabilirsiniz.

**Tüm Çağrılarınız Tek Platformda Toplansın** — Whatsapp: Whatsapp hesabınıza gelen mesajları ve talepleri otomatik olarak kayıt altına alabilirsiniz

- Misafir bilgileri, Otel adı, İletişim şekli, Çağrı Yönü, Çağrı Kanalı ve Referans bilgileri tek ekranda görünür

- Misafir bilgileri, Otel adı, İletişim şekli, Çağrı Yönü, Çağrı Kanalı ve Referans bilgileri tek ekranda görünür
- Çağrıyı yapan misafirin geçmiş tarihli aramaları, istekleri, geçmiş rezervasyon talepleri, otel konaklamaları ve gelecek rezervasyonlarına ait bilgilere kolaylıkla ulaşılır
- Misafirin talep ettiği bir iş ya da görev varsa talep oluşturulabilir veya ilettiği yorum kayıt altına alınabilir
- Misafir deneyimlerini ölçümlemek için anket formları gönderilebilir

#### Скриншоты / визуалы

![cagri-merkezi-programi-1](screenshots/elektraweb/cagri-merkezi-programi-1.webp)

![cagri-merkezi-programi-2](screenshots/elektraweb/cagri-merkezi-programi-2.webp)

![cagri-merkezi-programi-3](screenshots/elektraweb/cagri-merkezi-programi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 10. Mobil Kimlik Okur

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `SmartIDReaderStandard` |
| **Product ID** | 302 |
| **Страница** | [mobil-kimlik-okur-ve-check-in](https://www.elektraweb.com/mobil-kimlik-okur-ve-check-in/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-mobile-idreader/index.html) |

**Назначение:** Eptera Standart Smart ID Reader is a mobile solution that lets hotels scan guest IDs and passports instantly using a phone or tablet camera, and transfer the details directly into the PMS. It includes up to 1,000 scans per month.

#### Скриншоты / визуалы

![mobil-kimlik-okur-ve-check-in-1](screenshots/elektraweb/mobil-kimlik-okur-ve-check-in-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 11. Check-in Kiosk

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `CheckInKiosk` |
| **Product ID** | 303 |
| **Страница** | [check-in-kiosk](https://www.elektraweb.com/check-in-kiosk/) |

**Назначение:** Eptera Check-in Kiosk is a self service check in solution that lets guests complete check in within minutes from a kiosk tablet placed in the lobby, bar, or any convenient area.

#### Скриншоты / визуалы

![check-in-kiosk-1](screenshots/elektraweb/check-in-kiosk-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 12. Dinamik Fiyatlandırma

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `DynamicPricing` |
| **Product ID** | 296 |
| **Страница** | [fiyat-yonetimi](https://www.elektraweb.com/fiyat-yonetimi/) |

**Назначение:** Dynamic Pricing allows hotels to automatically update room rates based on occupancy levels. Rates are optimized in real time according to current demand, helping increase revenue while reducing manual work and saving time for the team.

#### Функциональные блоки (с сайта)

**Dinamik Fiyatlandırma** — Dinamik Fiyatlandırma, otellerin doluluk oranlarına göre oda fiyatlarını otomatik olarak güncelleyebilmesini sağlayan yenilikçi bir özelliktir. Bu sistem sayesinde fiyatlar, anlık doluluk seviyelerine göre optimize edilir; böylece hem gelir artışı sağlanır hem de manuel müdahaleye gerek kalmadan zaman ve iş gücü tasarrufu elde edilir.

#### Скриншоты / визуалы

![fiyat-yonetimi-1](screenshots/elektraweb/fiyat-yonetimi-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 13. Sadakat ve CRM

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `CRM` |
| **Product ID** | 41 |
| **Страница** | [elektraweb-sadakat-ve-crm-yonetimi](https://www.elektraweb.com/elektraweb-sadakat-ve-crm-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-crm/crm/index.html) |

**Назначение:** Enhances guest engagement through automation, personalized communication, loyalty points, targeted benefits, and detailed customer insights.

#### Функциональные блоки (с сайта)

**CRM ve Sadakat Yönetimi** — Misafirlerinizin tekrar geliş sayısını arttırmak ve onları daha yakından tanımak için Sadakat Yönetimi ile kampanyalar düzenleyebilir ve puan kazanmalarını sağlayabilirsiniz. Misafirlerin kazanacakları puanlar bir sonraki tatilleri için yeniden sizi tercih etmeleri için etken olacaktır.

#### Скриншоты / визуалы

![elektraweb-sadakat-ve-crm-yonetimi-1](screenshots/elektraweb/elektraweb-sadakat-ve-crm-yonetimi-1.jpg)

![elektraweb-sadakat-ve-crm-yonetimi-2](screenshots/elektraweb/elektraweb-sadakat-ve-crm-yonetimi-2.png)

![elektraweb-sadakat-ve-crm-yonetimi-3](screenshots/elektraweb/elektraweb-sadakat-ve-crm-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 14. Akıllı Sohbet

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `ArtificialIntelligenceIntegration` |
| **Product ID** | 314 |
| **Страница** | [akilli-sohbet](https://www.elektraweb.com/akilli-sohbet/) |

**Назначение:** İtibar Yönetimi Yapay Zeka Entegrasyonu yıllık kullanım ücreti

#### Скриншоты / визуалы

![akilli-sohbet-1](screenshots/elektraweb/akilli-sohbet-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 15. İtibar Yönetimi

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `ReputationManagement` |
| **Product ID** | 273 |
| **Страница** | [itibar-yonetimi](https://www.elektraweb.com/itibar-yonetimi/) |

**Назначение:** Aggregates online reviews, analyzes sentiment with AI, and delivers actionable insights for reputation improvement.

#### Функциональные блоки (с сайта)

**Elektraweb İtibar Yönetimi ile Çevrimiçi İtibarınızı Zirveye Taşıyın!** — Otelinizin çevrimiçi itibarını en gelişmiş yapay zek&acirc; teknolojileriyle profesyonelce yönetin, dijital dünyada güçlü ve güvenilir bir imaj oluşturun.

- Google, Tripadvisor, Booking, Expedia gibi platformlardan yorumları anlık toplar ve analiz ederiz.
- Yorumları otomatik olarak sınıflandırıp, dilinize çevirir, olumlu/olumsuz şeklinde puanlarız.
- Yapay zek&acirc; destekli araçlarımızla, misafirlerinize tek tıkla kendi dillerinde profesyonel yanıtlar verirsiniz.
- Otelinizde h&acirc;l&acirc; konaklayan misafirlerin olumsuz yorumlarını anında bildirerek hızlı çözüm sağlar.
- Detaylı performans analiziyle iyileştirme gereken alanları kolayca keşfedersiniz.

#### Скриншоты / визуалы

![itibar-yonetimi-1](screenshots/elektraweb/itibar-yonetimi-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 16. Web Sitesi Tasarımı

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `PredesignedWebsite` |
| **Product ID** | 35 |
| **Страница** | [web-sitesi-tasarimi](https://www.elektraweb.com/web-sitesi-tasarimi/) |

#### Функциональные блоки (с сайта)

**Web Sitesi Tasarımı** — Modern ve Profesyonel Tasarım ile misafirlerinize güven veren, itibarlı ve prestijli bir marka algısı yaratın.

#### Скриншоты / визуалы

![web-sitesi-tasarimi-1](screenshots/elektraweb/web-sitesi-tasarimi-1.png)

![web-sitesi-tasarimi-2](screenshots/elektraweb/web-sitesi-tasarimi-2.png)

![web-sitesi-tasarimi-3](screenshots/elektraweb/web-sitesi-tasarimi-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 17. Misafir Uygulaması

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `GuestMobileApplication(SuperAssistant)` |
| **Product ID** | 262 |
| **Страница** | [misafir-uygulamasi](https://www.elektraweb.com/misafir-uygulamasi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-guest-app/index.html) |

**Назначение:** Guest Generic Mobile Application is a ready to use guest mobile app with standard features. It is not published under a specific hotel name and it is not branded for a single property. It covers core functions like guest messaging, service requests, and basic reservation related flows.

#### Функциональные блоки (с сайта)

**Hem Müşteri Memnuniyetiniz Artsın, Hem de Kazancınız** — Misafirlerinize benzersiz ve ayrıcalıklı bir konaklama deneyimi sunan Elektra Misafir Mobil Uygulaması, modern otelcilikte ihtiyaç duyduğunuz tüm özellikleri tek platformda buluşturuyor:

**Dijital Dönüşümü Otelinize Taşıyın, Operasyonlarınızı Kolaylaştırın** — Bilgilendirme: Misafirleriniz oteliniz ve çevresi hakkında güncel bilgilere anında erişerek keyifli bir deneyim yaşar.

**Restoranlardan Golf Sahalarına Tesisteki Tüm Mekanların Rezervasyonu Online** — Planlama: Misafirler konaklamalarını daha iyi organize eder, etkinliklerden maksimum fayda sağlar.

**Misafirleriniz ile Her An İletişimde Kalın** — Talep Etme: Misafir talepleri hızlı ve dijital ortamda iletilir, böylece hizmet kaliteniz artar ve operasyonunuz hızlanır.

#### Скриншоты / визуалы

![misafir-uygulamasi-1](screenshots/elektraweb/misafir-uygulamasi-1.png)

![misafir-uygulamasi-2](screenshots/elektraweb/misafir-uygulamasi-2.png)

![misafir-uygulamasi-3](screenshots/elektraweb/misafir-uygulamasi-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 18. Devremülk ve Devre Tatil

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `Timeshare` |
| **Product ID** | 239 |
| **Страница** | [devremulk-ve-devre-tatil-yonetimi](https://www.elektraweb.com/devremulk-ve-devre-tatil-yonetimi/) |

**Назначение:** Eptera Timeshare module simplifies hotel operations with contract management, annual tracking, and period based pricing lists.

#### Функциональные блоки (с сайта)

**Devremülk ve Devre Tatil Yönetimi** — Elektraweb Devremülk ve Devre Tatil Programı&rsquo;na web tabanlı yapısı sayesinde her yerden ulaşılabilir. Satış ekibi sisteme her zaman bağlanıp sözleşme girebilir, boş daire ve dönem bilgilerini görebilir. Sözleşmelerin girilmesi, senetlerin yazdırılması işlemi, kolaylıkla ofis dışından bile yapılabilir

#### Скриншоты / визуалы

![devremulk-ve-devre-tatil-yonetimi-1](screenshots/elektraweb/devremulk-ve-devre-tatil-yonetimi-1.jpg)

![devremulk-ve-devre-tatil-yonetimi-2](screenshots/elektraweb/devremulk-ve-devre-tatil-yonetimi-2.png)

![devremulk-ve-devre-tatil-yonetimi-3](screenshots/elektraweb/devremulk-ve-devre-tatil-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 19. WhatsApp API

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `WhatsappIntegration` |
| **Product ID** | 43 |
| **Страница** | [whatsapp-api](https://www.elektraweb.com/whatsapp-api/) |

**Назначение:** Enables personalized WhatsApp communications with template messages and automated workflows (requires CRM).

#### Скриншоты / визуалы

![whatsapp-api-1](screenshots/elektraweb/whatsapp-api-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 20. Karbon Dengeleme

| | |
|---|---|
| **Категория** | Otel / PMS |
| **Код (API)** | `Development(CarbonNotr)` |
| **Product ID** | 274 |
| **Страница** | [karbon-ayak-izi-sifirlama-modulu](https://www.elektraweb.com/karbon-ayak-izi-sifirlama-modulu/) |

**Назначение:** Eptera Carbon Offsetting module calculates the carbon footprint of a guest stay, processes the offset payment online, and issues an internationally approved certificate in the guest’s name with QR verification.

#### Функциональные блоки (с сайта)

**Karbon Ayak İzi Sıfırlama Modülü** — YEŞİL OTEL OLMANIN AVANTAJLARINI YAŞAYIN

#### Скриншоты / визуалы

![karbon-ayak-izi-sifirlama-modulu-1](screenshots/elektraweb/karbon-ayak-izi-sifirlama-modulu-1.png)

![karbon-ayak-izi-sifirlama-modulu-2](screenshots/elektraweb/karbon-ayak-izi-sifirlama-modulu-2.png)

![karbon-ayak-izi-sifirlama-modulu-3](screenshots/elektraweb/karbon-ayak-izi-sifirlama-modulu-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

## 3. PMS Ön Büro — подмодули ядра

> Входит в лицензию **PMS** — отдельно не продаётся. Это функциональные экраны внутри Ön Büro.

### 3.1. Rezervasyon İşlemleri

- Rezervasyonlar herhangi bir kritere göre tek tuşla listelenebilir, sıralanabilir, gruplanabilir ve filtrelenebilir
- Renklendirmeler sayesinde dikkat edilmesi gereken bilgiler kolayca görülür
- Tek tuşla tüm işlemlere ulaşılır, tekve/veya toplu olarak işlem yapılır
- Tüm ekranlar farklı formatlarda Excel’e veya yazıcıya aktarılır
- Listelerde çoklu sıralama, filtreleme, arama, gruplama standarttır
- Dijital arşivleme yeteneği sayesinde tüm belgeler, ilgili kaydın içerisine saklanır
- Kullanıcılar yetkilerine göre menüde ve formlarda sadece izin verilen bilgileri görebilir ve işlem yapabilir

### 3.2. Rezervasyon Kartı

- Rezervasyonla ilgili tüm detaylar bir arada
- No more duplicates ! Misafir kontrol ile eski verilere ulaşım otomatik ve sınırsız profil açma – eşleme
- Tek tuşla oda tipi müsaitliğine ulaşım.
- Tek tuşla oda blokajı yapabilme.
- Acenta detaylarına, fiyatlara, misafir bilgilerine, satış projelerine hızlı erişme.
- Fiyatlandırma sekmesine ulaşım için yetki kontrolü; fiyatlandırma ile ilgili tüm veriler bir arada.

### 3.3. Kat Hizmetleri

- Elektraweb Otel Programı ile tüm kat hizmetleri işlemleri dijital ortamda yapılabilir
- Oda durumuna göre, eşit ağırlıklı olarak maid dağılımı yapabilirsiniz.
- Kat Görevlisi ve Şef raporlarını alabilirsiniz.

### 3.4. Folyo İşlemleri

- Ödeme, posting ve faturalama işlemleri aynı ekrandan tek tuşla yapılır; zaman kazandırır.
- Aynı anda değişik para birimleri ile işlem girilebilir otomatik çevirim sağlar.
- Oda hesabı sınırsız farklı pencerelerde görüntülenerek ödeme alınır, hesap girilir, fatura kesilir.
- Detaylı ve farklı formattaki tasarımlarla istenilen formatta folyo çıktısı verir.

### 3.5. Ön Muhasebe

- İstenilen para biriminde işlem yapılabilir
- Günlük harcamalar raporlanabilir.
- Döviz bozma işlemleri hızlıdır.
- Kasa raporu ayrıntılı ve kolay anlaşılırdır.Elektraweb, cari hesap,
- borç – alacak takibi,
- kasa takibi,
- personel hesap takibi,
- fatura ve irsaliye düzenleme,
- çek ve senetlerin vade takibi

### 3.6. Forecast ve Analizler

- İstenilen iki tarih arasındaki doluluk hareketlilik ve gelirleri grafik ve detaylı analizlerle gösterir.
- Kullanımı çok kolaydır. grafikte bir günün üzerine tıklandığında o güne ait değişik listeleri otomatik hazırlar.
- Rezervasyon kartına yazdığınız her detaya göre forecast alabilmenizi sağlar.

### 3.7. Blokaj

- Önbürodaki operasyonun tamamını (Rezervasyon, Checkin-Checkout, Folyo, Blokaj, Tahsilat) yapabileceğiniz şekilde tasarlanmıştır.
- ElektraWeb Blokaj ekranından misafirin rezervasyon kartına ulaşabilir, sürükle bırak ile oda – tarih değiştirilebilir, tahsilat, chin/chout işlem girişi yapabilir, folyosuna gidebilirsiniz.
- Online kanallardan gelen ve daha oda ataması yapılmamış rezervasyonlarınızı da blokajda en üstte görebilir, sürükle bırak ile oda verebilirsiniz.
- Yine bu ekranda kanal yönetimi işlemleri yapılabilir ve POS bilgileri girilebilir.

### 3.8. Roomrack

- Anlık oda durumları tek ekranda görüntülenebilir, temizlik ve doluluğa göre farklı renklerle işaretlenebilir
- Gösterilen odalar filtrelenip girişlere, çıkışlara ve konaklayanlara kolaylıkla ulaşılabilir
- Bu ekrandan çıkmadan seçilen oda üzerinde tahsilat, folyo ve check-out işlemleri yapılabilir
- VIP, geç check-in ve check-outlar için kuyruktaki odalar görsel simgeler ile işaretlenebilir

### 3.9. Görev ve İş Yönetimi

- Girilen tüm istek ve şikayetler otomatik görev yönetimine dahil olur. İşin tanımına göre, bölümü, yetkilisi, önemi ve beklenen bitiş süresi belirlenir.
- İş, ilgili birimin ekranına veya mobil cihazına düşer. Çağrıyı alan görevli “göreve başla” tuşuna basarak başlar ve bittiğinde ise “tamamla” diyerek bitirir.
- Eğer iş, planlanan ve/veya max zaman diliminde bitmez ise otomatik bir üste mesaj gider.
- Misafir ile ilgili olan işlemler rezervasyon kartı içerisinden de takip edilir. İstenirse check-in, check-out,folyo ve faturalama işlemleri esnasında otomatik hatırlatma yapar.
- VIP, setup ve ön ödeme kontrol gibi işlemler böylece hem hatırlatma hem de ilgili bölüme bir görev olarak tanımlanmış olur.

**Скриншоты PMS:** `screenshots/elektraweb/on-buro-1.png` … `on-buro-3.webp` + полный набор в `doc/.cache/pages/on-buro.html`

---

## 4. POS

### 1. Restoran POS

| | |
|---|---|
| **Категория** | POS |
| **Код (API)** | `POS` |
| **Product ID** | 7 |
| **Страница** | [restoran-pos-yonetim-programi](https://www.elektraweb.com/restoran-pos-yonetim-programi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-restaurant-management/pos/index.html) |

**Назначение:** Seamlessly integrates with PMS and inventory, enabling automatic posting to guest folios and streamlined F&B sales for both in-house and external customers.

#### Функциональные блоки (с сайта)

**Restoran POS Yönetimi Programı** — POS Yönetim Sistemi Nedir?

#### Скриншоты / визуалы

![restoran-pos-yonetim-programi-1](screenshots/elektraweb/restoran-pos-yonetim-programi-1.jpg)

![restoran-pos-yonetim-programi-2](screenshots/elektraweb/restoran-pos-yonetim-programi-2.png)

![restoran-pos-yonetim-programi-3](screenshots/elektraweb/restoran-pos-yonetim-programi-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 2. Restoran Online Rezervasyon

| | |
|---|---|
| **Категория** | POS |
| **Код (API)** | `DigitalMenu` |
| **Product ID** | 306 |
| **Страница** | [restoran-online-rezervasyon-sistemi](https://www.elektraweb.com/restoran-online-rezervasyon-sistemi/) |

#### Скриншоты / визуалы

![restoran-online-rezervasyon-sistemi-1](screenshots/elektraweb/restoran-online-rezervasyon-sistemi-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 3. Akıllı Dijital Menü

| | |
|---|---|
| **Категория** | POS |
| **Код (API)** | `DigitalMenu` |
| **Product ID** | 306 |
| **Страница** | [akilli-dijital-menu](https://www.elektraweb.com/akilli-dijital-menu/) |

#### Функциональные блоки (с сайта)

**Menünüz Dilediğiniz Gibi Görünsün** — Smart Menu, işletmelere farklı görünümlerde menü tasarımları sunar. Böylece farklı konseptlere sahip restoranlar, kendilerine en uygun görünümü seçebilir ve istedikleri özelleştirmeleri yaparak ihtiyaçlarına en uygun menüye sahip olabilirler.

- QR Kod ile Menüye Erişim Misafirler, QR kodu okutarak anında menüye ulaşır.
- 1.⁠ ⁠Çoklu Dil Seçeneği Misafirler menüyü kendi dillerinde inceleyebilir, ürünler hakkında detaylı bilgiye (içindekiler, alerjenler vb.) ulaşabilir.
- 2.⁠ ⁠İşletme Bilgileri Menüde Instagram, telefon, TripAdvisor gibi alanlar doldurulduğunda misafirler bu bilgilere Smart Menu üzerinden erişebilir.
- 3.⁠ ⁠Misafir Garson İletişimi Misafirler diledikleri an tek dokunuşla: Garson çağırabilir Hesap isteyebilir Garsona mesaj gönderebilir.

**Temel Özellikler** — 

- QR Kod ile Menüye Erişim Misafirler, QR kodu okutarak anında menüye ulaşır.
- 1.⁠ ⁠Çoklu Dil Seçeneği Misafirler menüyü kendi dillerinde inceleyebilir, ürünler hakkında detaylı bilgiye (içindekiler, alerjenler vb.) ulaşabilir.
- 2.⁠ ⁠İşletme Bilgileri Menüde Instagram, telefon, TripAdvisor gibi alanlar doldurulduğunda misafirler bu bilgilere Smart Menu üzerinden erişebilir.
- 3.⁠ ⁠Misafir Garson İletişimi Misafirler diledikleri an tek dokunuşla: Garson çağırabilir Hesap isteyebilir Garsona mesaj gönderebilir.
- Detaylı Ürün Bilgisi Misafirler ürün içeriğini, alerjenleri ve yanına uygun eşlikçi ürünleri tek ekranda görüntüleyebilir.
- Yapay Zeka ile Satışlarınızı Artırın Misafir sipariş oluştururken, yapay zeka siparişe en uygun eşlikçi ürünleri otomatik olarak önerir. Böylece misafirler daha kolay karar verir ve daha fazla ürün keşfeder.
- Akıllı İndirim Tanımlamaları Yapay zeka önerilerine özel indirimler tanımlayarak bu ürünleri daha cazip hale getirebilirsiniz.
- Tek Dokunuşla Sipariş Misafirler tek dokunuşla, kolayca sipariş verebilir.
- Akıllı Sipariş Onay Sistemi Siparişler, tercihinize göre doğrudan mutfağa iletilebilir veya garson onayına yönlendirilebilir.

**Rezervasyonlarınızı SmartMenu ile Tek Ekrandan Yönetin** — Doluluk, ön ödeme ve masa yönetimi artık çok daha kolay.

**Smart Menu'nün Avantajları** — İnteraktif bir deneyim sunar; misafirlerle etkileşim kurar, ürün önerileri yapar ve deneyimi sürekli geliştirir.

#### Скриншоты / визуалы

![akilli-dijital-menu-1](screenshots/elektraweb/akilli-dijital-menu-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 4. SPA ve Spor Salonu

| | |
|---|---|
| **Категория** | POS |
| **Код (API)** | `SPA` |
| **Product ID** | 12 |
| **Страница** | [spa-ve-spor-salonu-yonetimi](https://www.elektraweb.com/spa-ve-spor-salonu-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-spa/index.html) |

**Назначение:** Schedules rooms and staff, tracks sales and commissions, manages payments, and supports bulk operations within a single calendar.

#### Функциональные блоки (с сайта)

**SPA ve Spor Salonu Yönetimi** — Spa merkezleri, sağlık merkezleri, spor merkezleri, kulüpler ve dernekler gibi üyelikle çalışan tüm kurumlar için geliştirilmiş web tabanlı bir yazılımdır.

**Mobil Kullanım** — İnternet erişimi olan her yerden ve her cihazdan (cepten, tabletten, masaüstünden) rahatça kullanır ve teknolojinin sağladığı özgürlüğün keyfini çıkarırsınız. İlk satın alma maliyeti olmadığından programı hemen kullanmaya başlayabilirsiniz. ElektraWEB Spa sunucuya ihtiyaç duymadığından, sunucu ve sunucu lisanslarına ait maliyetlerden de kurtulursunuz.

**Hızlı ve Kolay Kullanım** — Masaüstü versiyonlara göre, ajanda ekranının açılması, işlem girilmesi ve tahsilat yapılması ortalama 5 kat kadar daha hızlıdır. Kolay kullanımlı ve görsel ekran tasarımına sahiptir. ElektraWeb ile entegre olduğundan otel ile bağlantısı mevcuttur. Kolay kullanımlı, görsel ekran tasarımına sahiptir. ElektraWeb ile entegreli olduğundan otel ile bağlantısı mevcuttur.

**Zaman ve İşlem Tasarrufu** — Telefon ve tablet üzerinden randevu alma ve üyelik yapma imkanı sağlar. Özellikle fitness üyelikleri için işletmeler öncesinde müşteriler ile birebir görüşme yapabilirler ve kişiye telefon veya tablet verip kendi üye kartını doldurmasını sağlayabilirler.

#### Скриншоты / визуалы

![spa-ve-spor-salonu-yonetimi-1](screenshots/elektraweb/spa-ve-spor-salonu-yonetimi-1.jpg)

![spa-ve-spor-salonu-yonetimi-2](screenshots/elektraweb/spa-ve-spor-salonu-yonetimi-2.jpg)

![spa-ve-spor-salonu-yonetimi-3](screenshots/elektraweb/spa-ve-spor-salonu-yonetimi-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

## 5. ERP

### 1. Muhasebe Yönetimi

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `ACC` |
| **Product ID** | 16 |
| **Страница** | [muhasebe-yonetimi](https://www.elektraweb.com/muhasebe-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-pms/cash-invoice-transactions/index.html) |

**Назначение:** A modern corporate accounting system unifies financial operations—general ledger, Accounts receivable and payable, budgeting, billing, banking, and reporting—into one secure platform for accurate control, compliance, and performance-driven decision making.

#### Функциональные блоки (с сайта)

**Muhasebe Yönetimi** — Otellerin ihtiyaçlarına göre özelleştirilmiş kapsamlı bir web tabanlı muhasebe yönetim sistemi dir. Ön muhasebe ve genel muhasebe dışında işletmenin idari süreçlerinin tamamını yönetebilecek satın alma, demirbaş, personel, stok ve satış yönetimi modüllerine de sahiptir. Tamamen modüler olarak tasarlandığından ihtiyaç doğrultusunda istenilen modüller sonradan da eklenebilir.

- Masraf merkezleri, proje kartları ve operasyon tanımlarına göre gelir ve gider analizi yapılabilir.
- Modüllerden otomatik olarak oluşan ve manuel de eklenebilen Ödeme Emirleri sayesinde nakit akışınızı planlayabilirsiniz.
- Vadesi gelen ödeme ve tahsilatları otomatik olarak hatırlatır.
- Yaşlandırma analizi sayesinde vadesi geçmiş borç ve alacaklarınızı görebilir, tek bir tuşla da satıcı firmalara olan borçlarınız için ödeme emirlerinizi oluşturabilirsiniz.

- Masraf Merkezleri
- Proje Kartları
- Operasyon Tanımları
- Hesap Planı ve Dövizli Hesap Takibi
- Muhasebe Fişleri,
- Ödeme Emirleri,
- e-Mutabakatlar,
- Yaşlandırma Analizi
- Mali Tablolar
- Finansal Durum
- Hesap Analizleri
- Masraf Merkezi Bazında Kar/Zarar Analizi
- Proje Maliyet Takibi
- Kur Değerleme Fişleri
- Yansıtma Fişleri

#### Скриншоты / визуалы

![muhasebe-yonetimi-1](screenshots/elektraweb/muhasebe-yonetimi-1.jpg)

![muhasebe-yonetimi-2](screenshots/elektraweb/muhasebe-yonetimi-2.jpeg)

![muhasebe-yonetimi-3](screenshots/elektraweb/muhasebe-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 2. e-Fatura / e-Arşiv / e-İrsaliye

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `E-InvoiceIntegration` |
| **Product ID** | 17 |
| **Страница** | [e-fatura-e-arsiv-e-irsaliye](https://www.elektraweb.com/e-fatura-e-arsiv-e-irsaliye/) |

**Назначение:** Eptera lets you manage e-Invoice e-Archive e-Delivery Note and e-Ledger processes in a compliant and streamlined way through your hotel system.

#### Функциональные блоки (с сайта)

**ELEKTRAWEB ile e-Fatura, e-Arşiv, e-Defter ve e-İrsaliye'yi HEMEN KULLANMAYA BAŞLAYIN** — Otelinizin "Dijital Dönüşüm" sürecini Elektra ile yönetebilirsiniz.

**Elektrawebliler Nasıl e-Fatura, e-Arşiv Kullanabilirler?** — Elektraweb Otel Programı, efinans, Turkcell, EDM, İzibiz ve Uyumsoft gibi piyasada en çok tercih edilen entegratörler ile entegrasyonlarını tamamlamıştır. E-fatura ve e-Arşiv mükellefi olmak isteyen konaklama işletmeleri mali mühürlerini aldıktan sonra entegrasyon ve kurulum işlemleri ile ilgili Elektraweb ekibi yönlendirme yapmaktadır

**e-Belgelerinize Nasıl Karekod Eklersiniz?** — Gelir İdaresi Başkanlığının, 17 Şubat 2023 tarihinde yayınladığı kılavuz kapsamında elektronik iletilen belgelere KAREKOD zorunluluğu getirilmiştir. Bu uygulama 01.09.2023 tarihi itibari ile yürürlüğe girecektir. E Fatura ve E Arşiv Fatura kullanıcısı olan işletmeler için mevzuata uygun tasarım yükleme işlemleri sırasıyla;

- Entegratör firmadan Karekod içeren tasarımı indirin. (Bu işlemler entegratör firma ekranından yapılır.)
- Kuruluş &gt; Otel Ayarları Paneli &gt; Entegratör Bağlantı Bilgiler i ekranından gidin.
- Bağlantı Ayarları ekranını açın.
- Ekrandaki Fatura Tasarımı Yükle butonuna tıklayın.
- Ekrandaki tasarımları X işareti ile silin.
- Dosya Seçiniz butonu ile indirdiğiniz tasarımları seçip yükleyin. (Dosya ismi defaultEfatura_HOTELID_ŞUBEID.xslt şeklinde olmalı ve otelin bilgileri yer almalıdır. Dosya ismi videoda detaylı gösterilmiştir.)
- Tasarımlar yüklendikten sonra sayfayı kaydedin .

#### Скриншоты / визуалы

![e-fatura-e-arsiv-e-irsaliye-1](screenshots/elektraweb/e-fatura-e-arsiv-e-irsaliye-1.jpg)

![e-fatura-e-arsiv-e-irsaliye-2](screenshots/elektraweb/e-fatura-e-arsiv-e-irsaliye-2.webp)

![e-fatura-e-arsiv-e-irsaliye-3](screenshots/elektraweb/e-fatura-e-arsiv-e-irsaliye-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 3. Stok Takip

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `STOCK` |
| **Product ID** | 14 |
| **Страница** | [stok-takip-programi](https://www.elektraweb.com/stok-takip-programi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/inventory-management/index.html) |

**Назначение:** Provides real-time procurement, inventory, cost control, stock levels, and purchase planning.

#### Функциональные блоки (с сайта)

**Stok Takip Programı** — işletmenizdeki stok hareketlerini görmenizi, alış ve satışlarınızı planlayabilmenizi, müşterilerinizin tüketim eğilimlerini tahmin etmenizi, personelinizin stokları kullanma şeklini analiz edebilmenizi ve nihayetinde hedefleriniz için öngörüde bulunabilmenizi sağlar.

**Otel Depo Hareketlerinin Takibi** — Elektraweb Depolama sürecinin etkin yönetimi için basit fakat detaylı veri yönetimi sağlar. Günde 20 ayrı firmadan, en az 100 çeşit malzeme geliyor ve 5 ayrı deponuza dağılıyor. Çuvalla mı gelmiş, tenekede mi? Faturaya koli fiyatı yazılmış. İhtiyaç acildi ve malzemelerin bir kısmı depoya girmeden üretime gönderildi, acaba kaçak olur mu?

#### Скриншоты / визуалы

![stok-takip-programi-1](screenshots/elektraweb/stok-takip-programi-1.jpg)

![stok-takip-programi-2](screenshots/elektraweb/stok-takip-programi-2.webp)

![stok-takip-programi-3](screenshots/elektraweb/stok-takip-programi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 4. Demirbaş Yönetimi

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `FixedAsset` |
| **Product ID** | 18 |
| **Страница** | [demirbas-ve-amortisman-yonetimi](https://www.elektraweb.com/demirbas-ve-amortisman-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/assets/index.html) |

**Назначение:** Tracks assets, amortization, barcode labeling, usage history, loss/waste, and vendor-based allocation.

#### Функциональные блоки (с сайта)

**Demirbaş ve Amortisman Yönetimi** — Elektraweb Demirbaş Programı barkotlu el bilgisayarı ile sayım yapabilen, ürünlerin özelliklerine ve yerlerine göre barkod basabilen, garanti ve servis anlaşmalarını takip edebilen ve muhasebe ile entegre çalışan bir modüldür.

- Demirbaş Yer Tanımları
- Demirbaş Ömür Kodları
- Demirbaş Grupları
- Demirbaş Kartları
- Demirbaş Sayım Kartları
- Demirbaş Amortisman Ayırma İşlemleri

#### Скриншоты / визуалы

![demirbas-ve-amortisman-yonetimi-1](screenshots/elektraweb/demirbas-ve-amortisman-yonetimi-1.jpg)

![demirbas-ve-amortisman-yonetimi-2](screenshots/elektraweb/demirbas-ve-amortisman-yonetimi-2.jpg)

![demirbas-ve-amortisman-yonetimi-3](screenshots/elektraweb/demirbas-ve-amortisman-yonetimi-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 5. Üretim ve Maliyet

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `F&B` |
| **Product ID** | 15 |
| **Страница** | [uretim-recetelendirme-ve-maliyet-analizi](https://www.elektraweb.com/uretim-recetelendirme-ve-maliyet-analizi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/inventory-management/index.html) |

**Назначение:** Eptera Production, Recipes & Costing helps hotels and restaurants manage ingredients, semi finished items, finished products, and portion level costing.

#### Функциональные блоки (с сайта)

**Ürün, Reçete ve Üretim** — Elektraweb &lsquo;de detaylı stok, ürün ve reçete tanımlamaları ile, stoklarınıza, işletmenize girişten, tüketim ve satış aşamalarına kadar geçen süreçte kullanılmak üzere pratik kimlik tanımlamaları yaparak, üretim ve satış işlemlerinizin hatasız gerçekleşmesini sağlarsınız

**Stok Modülü - POS Entegrasyonu** — Ürünler otelin veya restoranın POS programı ile entegre çalışabilmektedir. Bu entegrasyon ile satışı yapılan ürünlerin reçetelerindeki değerler stoklardan otomatik olarak düşer.

#### Скриншоты / визуалы

![uretim-recetelendirme-ve-maliyet-analizi-1](screenshots/elektraweb/uretim-recetelendirme-ve-maliyet-analizi-1.jpg)

![uretim-recetelendirme-ve-maliyet-analizi-2](screenshots/elektraweb/uretim-recetelendirme-ve-maliyet-analizi-2.jpg)

![uretim-recetelendirme-ve-maliyet-analizi-3](screenshots/elektraweb/uretim-recetelendirme-ve-maliyet-analizi-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 6. Satın Alma

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `Procurement` |
| **Product ID** | 19 |
| **Страница** | [satin-alma-yonetimi](https://www.elektraweb.com/satin-alma-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/inventory-management/index.html) |

**Назначение:** Eptera Procurement Software streamlines the full purchasing cycle from department requests to delivery. It supports multi location approval workflows based on warehouse, stock groups, or total amount, so every request follows the right chain automatically.

#### Скриншоты / визуалы

![satin-alma-yonetimi-1](screenshots/elektraweb/satin-alma-yonetimi-1.jpg)

![satin-alma-yonetimi-2](screenshots/elektraweb/satin-alma-yonetimi-2.webp)

![satin-alma-yonetimi-3](screenshots/elektraweb/satin-alma-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 7. Banka Entegrasyonları

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `AccountingIntegration` |
| **Product ID** | 26 |
| **Страница** | [banka-entegrasyonlari](https://www.elektraweb.com/banka-entegrasyonlari/) |

#### Скриншоты / визуалы

![banka-entegrasyonlari-1](screenshots/elektraweb/banka-entegrasyonlari-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 8. Personel ve Bordro

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `HR` |
| **Product ID** | 50 |
| **Страница** | [personel-ve-bordro-yonetimi](https://www.elektraweb.com/personel-ve-bordro-yonetimi/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/human-resources/index.html) |

**Назначение:** Centralizes employee data, documents, approvals, leave tracking, and internal communications through a personalized interface.

#### Функциональные блоки (с сайта)

- İş başvurularını online alabilir ve saklayabilirsiniz.
- SGK işe giriş ve işten ayrılış bildirgelerini tek tuşla verebilir, bordro oluşturabilirsiniz.
- Jandarma Kimlik Bildirimi online yapabilirsiniz.
- İzin, avans gibi talepleri online yönetebilirsiniz.
- Shift tanımları yapabilir ve raporlayabilirsiniz.
- Performans değerlendirmelerini yöneticiler online yapabilir.
- KVKK&rsquo;ya uygun dijital tebligat yapabilirsiniz.
- Personel ödemelerini bankalara otomatik iletebilirsiniz.
- Sicil kartları herhangi bir kritere göre listelenebilir, sıralanabilir, gruplanabilir ve filtrelenebilir.
- Tüm ekranlar excel&rsquo;e veya yazıcıya aktarılabilir.
- Sicil kartından tek tuşla bordro oluşturulabilir ve bordro ekranına geçiş yapılabilir.
- Tek tuşla SGK İşe Giriş ve İşten Ayrılış Bildirgeleri verilebilir, SGK dokümanı PDF olarak indirilebilir.
- İşe giriş ve ayrılış sürecindeki raporlamalara yazdır ekranından kolayca ulaşılabilir.
- Personele ait tüm bilgilere tek ekrandan kolayca ulaşılabilir.
- İzin işlemleri, icra ve avans takibi, aşı takibi ve zimmet takibi yapılabilir.

- Sicil kartları herhangi bir kritere göre listelenebilir, sıralanabilir, gruplanabilir ve filtrelenebilir.
- Tüm ekranlar excel&rsquo;e veya yazıcıya aktarılabilir.
- Sicil kartından tek tuşla bordro oluşturulabilir ve bordro ekranına geçiş yapılabilir.
- Tek tuşla SGK İşe Giriş ve İşten Ayrılış Bildirgeleri verilebilir, SGK dokümanı PDF olarak indirilebilir.
- İşe giriş ve ayrılış sürecindeki raporlamalara yazdır ekranından kolayca ulaşılabilir.
- Personele ait tüm bilgilere tek ekrandan kolayca ulaşılabilir.
- İzin işlemleri, icra ve avans takibi, aşı takibi ve zimmet takibi yapılabilir.
- Personele ait belge ve dokümanlar güvenli şekilde saklanabilir.
- Eğitim modülünde girilen tüm eğitimler personelin kartında görüntülenebilir.
- Yıllık izin, ücretli/ücretsiz izin girişi yapılabilir; yıllık izin takibi sistem tarafından otomatik yürütülür.
- İzin tarihlerine göre personelin bordrolarına otomatik puantaj oluşturulabilir.
- SGK tarafından belirlenen taban ve tavan ücretler, vergi dilimleri, sakatlık indirimleri gibi tüm parametreler tek tuşla sisteme çekilebilir.
- Emekli ve normal bordrolara ait vergi parametre bilgileri otomatik oluşturulabilir.
- Oluşturulan parametrelere standart puantajlar tanımlanarak bordro dönemine göre gün sayıları otomatik olarak bordroya işlenebilir.
- Firma bazlı olacak şekilde ayrı parametre tabloları oluşturulabilir.

- Personele ait tüm bilgilere tek ekrandan kolayca ulaşılabilir.
- İzin işlemleri, icra ve avans takibi, aşı takibi ve zimmet takibi yapılabilir.
- Personele ait belge ve dokümanlar güvenli şekilde saklanabilir.
- Eğitim modülünde girilen tüm eğitimler personelin kartında görüntülenebilir.
- Yıllık izin, ücretli/ücretsiz izin girişi yapılabilir; yıllık izin takibi sistem tarafından otomatik yürütülür.
- İzin tarihlerine göre personelin bordrolarına otomatik puantaj oluşturulabilir.
- SGK tarafından belirlenen taban ve tavan ücretler, vergi dilimleri, sakatlık indirimleri gibi tüm parametreler tek tuşla sisteme çekilebilir.
- Emekli ve normal bordrolara ait vergi parametre bilgileri otomatik oluşturulabilir.
- Oluşturulan parametrelere standart puantajlar tanımlanarak bordro dönemine göre gün sayıları otomatik olarak bordroya işlenebilir.
- Firma bazlı olacak şekilde ayrı parametre tabloları oluşturulabilir.
- Personellere ait puantaj bilgilerine göre bordro hazırlanabilir, ek kazançlar sisteme eklenebilir.
- Personelin aylık, günlük veya saatlik ücretine göre netten brüte veya brütten nete maaş tahakkukları yapılabilir.
- Firma tarafından çalışılan banka için banka maaş ödeme listesi tek tuşla alınabilir.
- Muhtasar beyanname için otomatik TXT dosyası oluşturulabilir.

- SGK tarafından belirlenen taban ve tavan ücretler, vergi dilimleri, sakatlık indirimleri gibi tüm parametreler tek tuşla sisteme çekilebilir.
- Emekli ve normal bordrolara ait vergi parametre bilgileri otomatik oluşturulabilir.
- Oluşturulan parametrelere standart puantajlar tanımlanarak bordro dönemine göre gün sayıları otomatik olarak bordroya işlenebilir.
- Firma bazlı olacak şekilde ayrı parametre tabloları oluşturulabilir.
- Personellere ait puantaj bilgilerine göre bordro hazırlanabilir, ek kazançlar sisteme eklenebilir.
- Personelin aylık, günlük veya saatlik ücretine göre netten brüte veya brütten nete maaş tahakkukları yapılabilir.
- Firma tarafından çalışılan banka için banka maaş ödeme listesi tek tuşla alınabilir.
- Muhtasar beyanname için otomatik TXT dosyası oluşturulabilir.
- Personel shift tanımlarınızı kolayca yapabilir ve raporlayabilirsiniz.
- Departman müdürleri kendi kullanıcı bilgileriyle giriş yaparak sadece kendi departmanına ait personellerin shift tanımlarını yönetebilir.
- Shift ekranı haftalık veya aylık olarak görüntülenebilir.
- Toplu olarak bir departmana shift atanabilir.

- Personellere ait puantaj bilgilerine göre bordro hazırlanabilir, ek kazançlar sisteme eklenebilir.
- Personelin aylık, günlük veya saatlik ücretine göre netten brüte veya brütten nete maaş tahakkukları yapılabilir.
- Firma tarafından çalışılan banka için banka maaş ödeme listesi tek tuşla alınabilir.
- Muhtasar beyanname için otomatik TXT dosyası oluşturulabilir.
- Personel shift tanımlarınızı kolayca yapabilir ve raporlayabilirsiniz.
- Departman müdürleri kendi kullanıcı bilgileriyle giriş yaparak sadece kendi departmanına ait personellerin shift tanımlarını yönetebilir.
- Shift ekranı haftalık veya aylık olarak görüntülenebilir.
- Toplu olarak bir departmana shift atanabilir.
- Eğitim tanımları yapılarak katılacak personeller seçilebilir ve eğitim raporları oluşturulabilir.
- Aktarılan personellerin eğitim kayıtları otomatik olarak sicil kartlarında görüntülenebilir.

- Muhtasar beyanname için otomatik TXT dosyası oluşturulabilir.
- Personel shift tanımlarınızı kolayca yapabilir ve raporlayabilirsiniz.
- Departman müdürleri kendi kullanıcı bilgileriyle giriş yaparak sadece kendi departmanına ait personellerin shift tanımlarını yönetebilir.
- Shift ekranı haftalık veya aylık olarak görüntülenebilir.
- Toplu olarak bir departmana shift atanabilir.
- Eğitim tanımları yapılarak katılacak personeller seçilebilir ve eğitim raporları oluşturulabilir.
- Aktarılan personellerin eğitim kayıtları otomatik olarak sicil kartlarında görüntülenebilir.
- Web siteniz üzerinden iş başvuruları alınabilir ve başvuru yapan adayların tüm bilgileri otomatik olarak CV ekranına kaydedilebilir.
- İşe alım gerçekleşmesi durumunda bu bilgiler tek tuşla sicil kartına aktarılabilir.
- Çalışan personeller kendi kullanıcı bilgileriyle sisteme giriş yaparak istedikleri tarih aralıklarında kolayca izin talep edebilir.

- Personel shift tanımlarınızı kolayca yapabilir ve raporlayabilirsiniz.
- Departman müdürleri kendi kullanıcı bilgileriyle giriş yaparak sadece kendi departmanına ait personellerin shift tanımlarını yönetebilir.
- Shift ekranı haftalık veya aylık olarak görüntülenebilir.
- Toplu olarak bir departmana shift atanabilir.
- Eğitim tanımları yapılarak katılacak personeller seçilebilir ve eğitim raporları oluşturulabilir.
- Aktarılan personellerin eğitim kayıtları otomatik olarak sicil kartlarında görüntülenebilir.
- Web siteniz üzerinden iş başvuruları alınabilir ve başvuru yapan adayların tüm bilgileri otomatik olarak CV ekranına kaydedilebilir.
- İşe alım gerçekleşmesi durumunda bu bilgiler tek tuşla sicil kartına aktarılabilir.
- Çalışan personeller kendi kullanıcı bilgileriyle sisteme giriş yaparak istedikleri tarih aralıklarında kolayca izin talep edebilir.
- Personellerin yöneticileri, tanımlanmış onay süreci doğrultusunda izin taleplerini değerlendirebilir ve işleme alabilir.
- İzin onay süreci firma yapısına göre esnek şekilde düzenlenebilir.

- Eğitim tanımları yapılarak katılacak personeller seçilebilir ve eğitim raporları oluşturulabilir.
- Aktarılan personellerin eğitim kayıtları otomatik olarak sicil kartlarında görüntülenebilir.
- Web siteniz üzerinden iş başvuruları alınabilir ve başvuru yapan adayların tüm bilgileri otomatik olarak CV ekranına kaydedilebilir.
- İşe alım gerçekleşmesi durumunda bu bilgiler tek tuşla sicil kartına aktarılabilir.
- Çalışan personeller kendi kullanıcı bilgileriyle sisteme giriş yaparak istedikleri tarih aralıklarında kolayca izin talep edebilir.
- Personellerin yöneticileri, tanımlanmış onay süreci doğrultusunda izin taleplerini değerlendirebilir ve işleme alabilir.
- İzin onay süreci firma yapısına göre esnek şekilde düzenlenebilir.
- İş Gücü Devir Oranı (Turnover); belirli bir ay veya yıl içinde işletmeden ayrılan ve işe giren personellerin çalışma sürelerini oranlayan rapordur.
- Turnover oranı ne kadar düşükse, şirketin çalışan verimliliği ve istikrarı o kadar yüksek kabul edilir.
- Elektra İnsan Kaynakları Programı, departmanlar ve firmalar bazında verimliliği grafiksel olarak hesaplayabilir.
- Turnover raporu ile çalışma süreleri, departman bazlı devir oranı, işe giriş ve işten ayrılma oranları analiz edilebilir.

- Web siteniz üzerinden iş başvuruları alınabilir ve başvuru yapan adayların tüm bilgileri otomatik olarak CV ekranına kaydedilebilir.
- İşe alım gerçekleşmesi durumunda bu bilgiler tek tuşla sicil kartına aktarılabilir.
- Çalışan personeller kendi kullanıcı bilgileriyle sisteme giriş yaparak istedikleri tarih aralıklarında kolayca izin talep edebilir.
- Personellerin yöneticileri, tanımlanmış onay süreci doğrultusunda izin taleplerini değerlendirebilir ve işleme alabilir.
- İzin onay süreci firma yapısına göre esnek şekilde düzenlenebilir.
- İş Gücü Devir Oranı (Turnover); belirli bir ay veya yıl içinde işletmeden ayrılan ve işe giren personellerin çalışma sürelerini oranlayan rapordur.
- Turnover oranı ne kadar düşükse, şirketin çalışan verimliliği ve istikrarı o kadar yüksek kabul edilir.
- Elektra İnsan Kaynakları Programı, departmanlar ve firmalar bazında verimliliği grafiksel olarak hesaplayabilir.
- Turnover raporu ile çalışma süreleri, departman bazlı devir oranı, işe giriş ve işten ayrılma oranları analiz edilebilir.
- Elektraweb İnsan Kaynakları Programı üzerinden personelinize ait ücret bordroları dahil tüm evrakları, yasal geçerliliğe sahip ve hukuki delil niteliğinde elektronik ortamda iletebilirsiniz.

- Çalışan personeller kendi kullanıcı bilgileriyle sisteme giriş yaparak istedikleri tarih aralıklarında kolayca izin talep edebilir.
- Personellerin yöneticileri, tanımlanmış onay süreci doğrultusunda izin taleplerini değerlendirebilir ve işleme alabilir.
- İzin onay süreci firma yapısına göre esnek şekilde düzenlenebilir.
- İş Gücü Devir Oranı (Turnover); belirli bir ay veya yıl içinde işletmeden ayrılan ve işe giren personellerin çalışma sürelerini oranlayan rapordur.
- Turnover oranı ne kadar düşükse, şirketin çalışan verimliliği ve istikrarı o kadar yüksek kabul edilir.
- Elektra İnsan Kaynakları Programı, departmanlar ve firmalar bazında verimliliği grafiksel olarak hesaplayabilir.
- Turnover raporu ile çalışma süreleri, departman bazlı devir oranı, işe giriş ve işten ayrılma oranları analiz edilebilir.
- Elektraweb İnsan Kaynakları Programı üzerinden personelinize ait ücret bordroları dahil tüm evrakları, yasal geçerliliğe sahip ve hukuki delil niteliğinde elektronik ortamda iletebilirsiniz.
- Bordro, sözleşme, atama/görevlendirme yazısı, maaş/prim bildirimleri, savunma ve ihtar belgeleri, hedef/performans bildirimleri gibi tüm tebliğ edilmesi zorunlu evrakların iletim süreci tamamen elektronik ortamda yönetilebilir.
- Bu sistem; belgelerin gönderildiği biçimde korunmasını sağlayan, alıcı kimliğini kesin olarak tespit eden, içeriği değiştirilemez hale getiren, yasal geçerliliği olan ve iş mahkemelerinde 1. dereceden delil kabul edilen güvenli bir altyapı sunar.

- İş Gücü Devir Oranı (Turnover); belirli bir ay veya yıl içinde işletmeden ayrılan ve işe giren personellerin çalışma sürelerini oranlayan rapordur.
- Turnover oranı ne kadar düşükse, şirketin çalışan verimliliği ve istikrarı o kadar yüksek kabul edilir.
- Elektra İnsan Kaynakları Programı, departmanlar ve firmalar bazında verimliliği grafiksel olarak hesaplayabilir.
- Turnover raporu ile çalışma süreleri, departman bazlı devir oranı, işe giriş ve işten ayrılma oranları analiz edilebilir.
- Elektraweb İnsan Kaynakları Programı üzerinden personelinize ait ücret bordroları dahil tüm evrakları, yasal geçerliliğe sahip ve hukuki delil niteliğinde elektronik ortamda iletebilirsiniz.
- Bordro, sözleşme, atama/görevlendirme yazısı, maaş/prim bildirimleri, savunma ve ihtar belgeleri, hedef/performans bildirimleri gibi tüm tebliğ edilmesi zorunlu evrakların iletim süreci tamamen elektronik ortamda yönetilebilir.
- Bu sistem; belgelerin gönderildiği biçimde korunmasını sağlayan, alıcı kimliğini kesin olarak tespit eden, içeriği değiştirilemez hale getiren, yasal geçerliliği olan ve iş mahkemelerinde 1. dereceden delil kabul edilen güvenli bir altyapı sunar.
- Personellerinizin giriş&ndash;çıkış bilgilerini anlık olarak kontrol edebilirsiniz.
- MagicPass 12628 &ndash; Parmak izi okuyucu
- MagicPass 126xx serisi &ndash; Parmak izi okuyucu
- MagicFace 302 &ndash; Yüz tanıma
- MagicFace 835 &ndash; Yüz tanıma
- ZKTECO C3-100/200/400
- MagicFace 20656 &ndash; Parmak izi okuyucu

**Resmi Belgelerin Elektronik Ortamda Gönderimi (e-Bordro)** — Bu cihazlar haricindeki entegrasyonlar için 250 &euro; ücretlendirme uygulanır.

- Elektraweb İnsan Kaynakları Programı üzerinden personelinize ait ücret bordroları dahil tüm evrakları, yasal geçerliliğe sahip ve hukuki delil niteliğinde elektronik ortamda iletebilirsiniz.
- Bordro, sözleşme, atama/görevlendirme yazısı, maaş/prim bildirimleri, savunma ve ihtar belgeleri, hedef/performans bildirimleri gibi tüm tebliğ edilmesi zorunlu evrakların iletim süreci tamamen elektronik ortamda yönetilebilir.
- Bu sistem; belgelerin gönderildiği biçimde korunmasını sağlayan, alıcı kimliğini kesin olarak tespit eden, içeriği değiştirilemez hale getiren, yasal geçerliliği olan ve iş mahkemelerinde 1. dereceden delil kabul edilen güvenli bir altyapı sunar.
- Personellerinizin giriş&ndash;çıkış bilgilerini anlık olarak kontrol edebilirsiniz.
- MagicPass 12628 &ndash; Parmak izi okuyucu
- MagicPass 126xx serisi &ndash; Parmak izi okuyucu
- MagicFace 302 &ndash; Yüz tanıma
- MagicFace 835 &ndash; Yüz tanıma
- ZKTECO C3-100/200/400
- MagicFace 20656 &ndash; Parmak izi okuyucu
- MagicFace MF 857 &ndash; Yüz tanıma
- MagicFace MF 900 &ndash; Yüz tanıma

#### Скриншоты / визуалы

![personel-ve-bordro-yonetimi-1](screenshots/elektraweb/personel-ve-bordro-yonetimi-1.png)

![personel-ve-bordro-yonetimi-2](screenshots/elektraweb/personel-ve-bordro-yonetimi-2.jpg)

![personel-ve-bordro-yonetimi-3](screenshots/elektraweb/personel-ve-bordro-yonetimi-3.webp)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 9. Şirketim İK Mobil

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `IKPP` |
| **Product ID** | 265 |
| **Страница** | [sirketim-ik-mobil-uygulama](https://www.elektraweb.com/sirketim-ik-mobil-uygulama/) |
| **Eptera docs** | [EN](https://eptera.com/eptera-resource-management/human-resources-portal/index.html) |

**Назначение:** The HR mobile app lets companies manage HR workflows together with quality management and audit processes from a single mobile platform. This improves operational efficiency while also supporting employee engagement and organizational transparency.

#### Функциональные блоки (с сайта)

**Tüm Yönetim Süreçleri Tek Bir Uygulamada** — Elektraweb'in geliştirdiği "Şirketim" isimli mobil uygulama; İK ve Kalite Denetimini tek platformda birleştirerek yöneticiler ve çalışanlar için tüm süreçleri kolay, hızlı ve şeffaf hale getiriyor.

- Onay ve takip süreçlerinde zaman tasarrufu
- Tek panelden tüm ekibin izin, mesai ve performans durumunu görme
- Şeffaf raporlama ile daha hızlı karar alma
- Kalite denetimleri için gerekli dokümanlara her an erişim
- Çalışan katılımı ve geri bildirimi sayesinde kurumsal iklimi net görme
- İzin, fazla mesai, avans ve bordro gibi tüm talepleri tek tuşla iletme
- Performans değerlendirmelerini, ödül ve uyarı süreçlerini şeffaf biçimde görebilme
- Eğitim ve görev tanımlarına kolay erişim
- Öneri ve şikayetlerini kayda alarak söz hakkı kazanma
- Duyuru ve etkinliklere anında ulaşarak kurumsal aidiyet hissi
- Kağıtsız ofis: Tüm süreçler dijital
- Zaman ve maliyet tasarrufu: Yönetsel yük azalır, verimlilik artar
- Kurumsal hafıza: Tüm bilgiler kayıtlı, denetime hazır
- Dijital kültür: Şirketin tüm işleyişi modern, planlı ve izlenebilir bir formatta ilerler

**AVANTAJLAR** — Elektraweb İnsan Kaynakları ve Kalite Yönetim Uygulaması, kurumların bugün ihtiyaç duyduğu şeffaf, planlayıcı, organize edici ve denetleyici sistemin dijital karşılığıdır.

- Onay ve takip süreçlerinde zaman tasarrufu
- Tek panelden tüm ekibin izin, mesai ve performans durumunu görme
- Şeffaf raporlama ile daha hızlı karar alma
- Kalite denetimleri için gerekli dokümanlara her an erişim
- Çalışan katılımı ve geri bildirimi sayesinde kurumsal iklimi net görme
- İzin, fazla mesai, avans ve bordro gibi tüm talepleri tek tuşla iletme
- Performans değerlendirmelerini, ödül ve uyarı süreçlerini şeffaf biçimde görebilme
- Eğitim ve görev tanımlarına kolay erişim
- Öneri ve şikayetlerini kayda alarak söz hakkı kazanma
- Duyuru ve etkinliklere anında ulaşarak kurumsal aidiyet hissi
- Kağıtsız ofis: Tüm süreçler dijital
- Zaman ve maliyet tasarrufu: Yönetsel yük azalır, verimlilik artar
- Kurumsal hafıza: Tüm bilgiler kayıtlı, denetime hazır
- Dijital kültür: Şirketin tüm işleyişi modern, planlı ve izlenebilir bir formatta ilerler
- Şirket için tam bir yönetim asistanı,

**ŞİRKETİM Mobil Arayüzü** — Profilim: Kendi bilgileriniz ve görev tanımlarınız burada.

- Menüdeki her başlık sizi ilgili sürece yönlendirir.
- Sağ üstteki ↻ ikonuyla ekranı yenileyebilir, ➤ ikonuyla çıkış yapabilirsiniz.
- Denemek için hemen bir izin isteğinde bulunabilir veya anket yanıtlayarak başlayabilirsiniz.

**İlk Kullanım İçin İpucu** — Tüm Operasyonlar Tek Ekranda - Çalışanların günlük işleyişine dair tüm talepler artık kağıttan, maillerden ve telefon trafiğinden çıkıp tek bir dijital platformda yönetiliyor. Bu sayfa, çalışan deneyiminin kalbini oluşturuyor.

- Menüdeki her başlık sizi ilgili sürece yönlendirir.
- Sağ üstteki ↻ ikonuyla ekranı yenileyebilir, ➤ ikonuyla çıkış yapabilirsiniz.
- Denemek için hemen bir izin isteğinde bulunabilir veya anket yanıtlayarak başlayabilirsiniz.

**Çalışma Süreçleri** — Tüm Operasyonlar Tek Ekranda - Çalışanların günlük işleyişine dair tüm talepler artık kağıttan, maillerden ve telefon trafiğinden çıkıp tek bir dijital platformda yönetiliyor. Bu sayfa, çalışan deneyiminin kalbini oluşturuyor.

**ŞİRKETİM ÇALIŞMA SÜREÇLERİ** — Çalışan izinlerini şeffaf biçimde takip eder, yöneticiler anında onay verebilir. Planlama kolaylaşır.

**ŞİRKETİM PERFORMANS VE GELİŞİM** — Her çalışan kendi performans değerlendirmesini görebilir, yöneticiler ise tek ekrandan ekip gelişimini takip eder. Böylece süreç adil, şeffaf ve ölçülebilir hale gelir.

**ŞİRKETİM KURUMSAL BİLGİLER** — Çalışma alanları tek ekranda gösterilerek iletişim ve yön bulma kolaylığı sağlanır.

**ŞİRKETİM İLETİŞİM VE KATILIM** — Şirket içi gelişmeler anında paylaşılır ve bilgilendirme gecikmeden yapılır.

#### Скриншоты / визуалы

![sirketim-ik-mobil-uygulama-1](screenshots/elektraweb/sirketim-ik-mobil-uygulama-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 10. Kalite ve Doküman Yönetimi

| | |
|---|---|
| **Категория** | ERP |
| **Код (API)** | `QM` |
| **Product ID** | 349 |
| **Страница** | [kalite-ve-dokuman-yonetim-sistemi](https://www.elektraweb.com/kalite-ve-dokuman-yonetim-sistemi/) |

**Назначение:** Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corporate documentation in one place.

#### Функциональные блоки (с сайта)

**Entegre Kalite Yönetimi ile Operasyonel Mükemmellik** — İşletmenizdeki departmanların kalite yönetimi için takip etmesi/doldurması gereken formları ve çizelgeleri, departmanlardan ayrı ayrı talep edip, kalite sistemine manuel olarak mı giriyorsunuz?

**İnsan Kaynakları** — Elektraweb Kalite ve Doküman Yönetimi, kalite süreçlerini hayata geçiren insan kaynağını da kapsayan bütüncül bir yapı sunar. Organizasyon şeması, departman ve pozisyon tanımları, görev tanımları ve personel bilgileri merkezi bir sistemde yönetilerek kurumun organizasyon yapısı şeffaf ve sürdürülebilir hale getirilir.

- Tüm pozisyonlara ait görevler sistemde standart formatlarda tanımlanır ve düzenlenir.
- Görevler, önem derecesine göre gruplanarak analiz edilir.
- Operasyon, satış, çağrı merkezli gibi farklı birimlere ait görevler tek çatı altında yönetilir.
- Sıra numarası ile görev akışı yapılandırılır ve süreçsel şeffaflık sağlanır.
- Tanımlar; kalite süreçleri, denetimler, eğitim ihtiyaç analizleri ve performans değerlendirme sistemleriyle entegre edilir .
- Güncellemeler merkezi olarak yönetilerek revizyonların tüm birimlere aynı anda yansıması sağlanır.

- Elektraweb Doküman Yönetimi Modülü; prosedür, talimat, form ve kayıtların oluşturulması, onaylanması, revize edilmesi ve arşivlenmesini merkezi bir yapı altında toplar.
- Tüm belgeler için onay, kontrol ve yayın süreçleri sistem tarafından otomatik olarak yürütülür; böylece güncel versiyon her zaman erişilebilir olur ve eski sürümlerin karışıklığı önlenir.
- Kullanıcılar, departman veya belge tipine göre dokümanlarını kolayca görüntüleyebilir, düzenleyebilir ve revizyon sürecini takip edebilir.
- Kullanıcılar, her doküman için metin girişi yapabilir, PDF dosyaları ekleyebilir ve URL bağlantılarıyla doküman içeriğini güvenli şekilde paylaşabilir.
- Bulut tabanlı yapısı sayesinde tüm bilgilere her yerden erişim sağlanır, kurum içi iletişim ve denetim süreçleri standartlaşır .
- Modül, ISO ve Turquality başta olmak üzere tüm kalite yönetim standartlarına uygun şekilde çalışır.
- Denetim Yönetimi, DOİF, Risk Yönetimi ve Eğitim Yönetimi modülleriyle entegre çalışarak kurumsal kalite süreçlerinin bütünsel yönetimini destekler.

- Çalışanlardan veya departmanlardan gelen revizyon taleplerini merkezi bir yapı altında toplar.
- Her talep; değerlendirme, onay süreci ve revizyon onay aşamalarında sistematik olarak izlenir.
- Bu sayede kurum içinde doküman değişiklikleri rastgele değil, tanımlı bir kalite akışı içinde yürütülür.
- Revizyon taleplerinin durumları (Yeni, Değerlendiriliyor, Onay Sürecinde, Revizyon Onaylandı, Revize Onaylanmadı) anlık olarak görüntülenebilir.
- Kullanıcı dostu arayüz, her dokümanın geçmişine ulaşmayı kolaylaştırır ve doküman güvenilirliğini korur.
- Elektraweb Denetim Yönetimi, işletmelerin tüm iç denetim, denetim formu oluşturma ve denetim sonuçlarının analiz süreçlerini tek platformda toplar.

- Elektraweb Denetim Yönetimi, işletmelerin tüm iç denetim, denetim formu oluşturma ve denetim sonuçlarının analiz süreçlerini tek platformda toplar.
- Her departman, her lokasyon veya tedarikçi için denetim kriterleri planlayarak, soruları tanımlayabilir ve sonuçları puanlayarak risk seviyelerini değerlendirebilirsiniz.
- Sahada başka bir cihaza gerek duyulmadan Elektraweb&rsquo;in geliştirilmiş olduğu ve Kalite Modülü ile birlikte çalışan DenetimApp uygulaması ile sahada yanıtlanan cevaplar sisteme anlık olarak kaydedilir.
- Denetim ekranında; soru bazında uygulama durumu, puan, risk etkisi, risk ihtimali ve gerekiyorsa DOİF kaydı aynı anda yönetilebilir.
- Sürükle-bırak özelliği ve size özel kolon tasarımları ile grafik analiz ekranları filtrelenebilir. Tamamlanan denetimler, &lsquo;Denetim Analizi&rsquo; ekranında departman, tarih, denetim türü veya bulguya göre raporlanır.
- Sonuç olarak; işletme standartlarınızla ölçülebilir veriye dönüştüren, sürdürülebilir kalite için yönetime karar desteği sağlayan bir denetim altyapısı sunar.
- Böylece denetim sonuçları sadece kaydedilmiş olmaz; iyileştirme, tekrar denetim ve risk azaltma süreçleriyle bütünleşik çalışır.

**Denetim Raporlama** — Denetim raporları artık tek bir tuşla hazırlanabilir. Manuel olarak saatler süren raporlama süreçleri saniyeler içinde tamamlanır; tüm bulgular, öneriler ve aksiyonlar eksiksiz şekilde sistemden otomatik olarak rapora yansır. Şirketin logo ve kurumsal bilgileriyle profesyonel bir formatta sunulan bu raporlar, hem üst yönetime hem de ilgili birimlere kolayca iletilebilir. Böylece ISO, TURQUALITY ve diğer tüm denetim süreci hızlanırken, ra

- Elektraweb DOİF Yönetimi Modülü, işletmelerin kalite ve operasyon süreçlerinde yürütülen denetim, risk analizi ve iç kontrol faaliyetleri sonucunda tespit edilen uygunsuzlukların sistematik biçimde kayıt altına alınmasını sağlar.

- Elektraweb DOİF Yönetimi Modülü, işletmelerin kalite ve operasyon süreçlerinde yürütülen denetim, risk analizi ve iç kontrol faaliyetleri sonucunda tespit edilen uygunsuzlukların sistematik biçimde kayıt altına alınmasını sağlar.
- DOİF Formu üzerinden düzeltici, önleyici veya iyileştirici faaliyet seçilerek; uygunsuzluk türü, tespit eden kişi, sorumlu departman, kök sebep, yapılacak faaliyet, boyut, seviye ve kapanış tarihi detaylı biçimde kaydedilir.
- Süreç boyunca ilgili fotoğraflar, dokümanlar, revize edilmiş prosedür bağlantıları ve yetkili pozisyon bilgileri eklenebilir.
- DOİF ekranı üzerinden faaliyet durumu (Yeni, Açık, Planlandı, Kapatıldı, İptal) izlenir; her adımda sistem otomatik bildirimler üretir.
- DOİF Analizi ekranı, kayıtların süresi, departmanı, kök nedeni ve boyutu bazında filtrelenmesini ve raporlanmasını sağlar.
- DOİF Modülü, TURQUALITY programı ile ISO 9001, ISO 22000, ISO 45001 gibi uluslararası kalite yönetim sistemlerinin gereklilikleri ile uyumlu bir yapı sunar.
- Bu yapı, kurum genelinde kalite bilincini, şeffaf raporlamayı ve sürekli iyileştirme kültürünü güçlendirir.

- Elektraweb Risk Yönetimi, kurumların faaliyet bazlı risk analizlerini standart bir format ile dijital ortamda yürütülmesini sağlar.
- Risk Analizi ekranında her faaliyet için tehlike, mevcut durum, olas&ı; risk, etkilenebilecek paydaşlar, tespitin tarihi ve açıklamalar tanımlanır.
- Her faaliyet çevresel, operasyonel, finansal veya iş güvenliği temelli riskler açısından değerlendirilir.
- Risk olasılığı, şiddeti ve frekansı tanımlanarak mevcut ve sonraki durumlar analiz edilir.
- Riskin etkilediği alanlar, önlem planları ve termin tarihleri kayıt altına alınır; bu sayede risklerin göz ardı edilmesi engellenir.
- Risk Azaltma seçenekleri (riski transfer et, riski yönet, faaliyetten kaçın, riski göze al vb.) işaretlenerek alınan aksiyon türü kayıt altına alınır.
- Tüm değerlendirme tabloları (olasılık, frekans, şiddet, risk değeri) tanımlanabilir yapıdadır ve kurumun kendi kriterlerine göre özelleştirilebilir.
- Kalite, İş Sağlığı ve Güvenliği, Gıda Güvenliği, Çevre ve Operasyon birimlerinde aktif olarak kullanılır.

- Elektraweb Ekipman Bakım Yönetimi Modülü, işletmedeki tüm ekipmanların konum, tür, bakım periyodu ve sorumluluklarını tek bir dijital sistemde toplar.
- Her ekipman için tip, lokasyon, iç/dış bakım periyodu, yasal zorunluluk durumu ve ilgili bakım firması tanımlanır.
- Bakım Sözleşmesi ekranında, sözleşme numarası, firma, başlangıç-bitiş tarihi ve ekipman bağlantısı yapılır.
- Her bakım kaydı, gerçekleşme durumu ve bakım firması bazında kayıt altına alınır; böylece düzenleme ve mutabakat ortadan kalkar.
- Bakım Takvimi, planlanan ve gerçekleşen bakımları ay sekmesinde listeler; bakım firması, tarih ve durum (planlandı/gerçekleşti) bilgilerini içerir.
- Bu yapı sayesinde kurumlar; iş güvenliği, operasyonel süreklilik ve kalite standartlarına süreçlebilir ölçüde korunur.

**Mevzuat Yönetimi** — Eğitim Tanımları: Kurumda verilen tüm eğitimlerin türünü, süresini ve geçerlilik süresini belirler. Zorunlu, oryantasyon, dil veya kişisel gelişim eğitimleri bu ekrandan tanımlanır. Eğitim süreleri, kategori bazında yönetilir; sistem yasal zorunluluk uyarıları verir.

- Mevzuat Yönetimi modülü, resmi gazetede yayınlanan her türlü mevzuat (yönetmelik, tebliğ, yönerge vb.) için detaylı kayıt ve revizyon takibi sağlar.
- Kurumun tabi olduğu tüm yasal düzenlemeleri, revizyon tarihlerini ve sorumlu departmanları sistematik biçimde kayıt altına alır.
- Her kayıt, ilgili departman, sorumlu kişi ve sorumlu kurum bilgileri ile ilişkilendirilir.
- "Revize" sekmesinde değişen maddeler, belge tipi ve uygunluk durumu ayrı satırlarda takip edilir.
- Böylece kurumsal denetimlerde, iç ve dış standartlara uygunluk net biçimde belgelenir.

**Eğitim Yönetimi** — Eğitim Tanımları: Kurumda verilen tüm eğitimlerin türünü, süresini ve geçerlilik süresini belirler. Zorunlu, oryantasyon, dil veya kişisel gelişim eğitimleri bu ekrandan tanımlanır. Eğitim süreleri, kategori bazında yönetilir; sistem yasal zorunluluk uyarıları verir.

**Ölçme ve Değerlendirme Yönetimi** — Ölçme ve Değerlendirme Yönetimi, kurumların ihtiyaç duyduğu sınav, form ve anket süreçlerini tek bir yapı altında toplayan kapsamlı bir yönetim modülüdür. Çalışan memnuniyetinden eğitim değerlendirmelerine, bilgi testlerinden operasyon formlarına kadar tüm ölçüm süreçleri dijital ortamda oluşturulur, uygulanır ve analiz edilir. Kullanıcılar, soru setlerini kolayca tasarlayabilir; sonuçlar ise

- Sınav, form ve anket süreçleri tek bir panel üzerinden oluşturulur, yapılandırılır ve yönetilir.
- Yorum, tek seçim, çoklu seçim ve derecelendirme gibi farklı soru tipleri tanımlanır ve süreçlerde kullanılır.
- Katılımcı bazlı yönetim yapılır; anonimlik ve görünürlük ayarları esnek şekilde belirlenir.
- QR kod üretilir ve mobil uyumlu ekranlar sayesinde hızlı doldurma deneyimi sağlanır.
- Soru, kategori ve cevap yapıları detaylı şekilde düzenlenir ve ihtiyaçlara göre özelleştirilir.
- Sonuçlar kişi bazlı veya soru bazlı olarak analiz edilir ve raporlanır.

#### Скриншоты / визуалы

![kalite-ve-dokuman-yonetim-sistemi-1](screenshots/elektraweb/kalite-ve-dokuman-yonetim-sistemi-1.jpg)

![kalite-ve-dokuman-yonetim-sistemi-2](screenshots/elektraweb/kalite-ve-dokuman-yonetim-sistemi-2.png)

![kalite-ve-dokuman-yonetim-sistemi-3](screenshots/elektraweb/kalite-ve-dokuman-yonetim-sistemi-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

## 6. Diğer решения

### 1. Elektraweb Lite

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `MINI` |
| **Product ID** | 177 |
| **Страница** | [elektraweb-lite](https://www.elektraweb.com/elektraweb-lite/) |

#### Функциональные блоки (с сайта)

**Oda Planı Özellikleri** — 1 - Seçilen periyoda göre ekranı görüntüleyebilme

**Rezervasyon Oluşturma ve Detayları** — 18 - Takvim üzerinde sürükleyerek rezervasyon oluşturabilme

- Sürükleyerek rezervasyon süresini uzatma veya kısaltma
- Sürükleyerek oda değişikliği veya tarih değişikliği yapabilme

**Fiyatlandırma** — 33 - Otomatik gelen günlük fiyatı manuel olarak değiştirebilme ve indirim yapabilme

**Folyo İşlemleri** — 37 - Hızlı postinge folyodan ulaşabilme

#### Скриншоты / визуалы

![elektraweb-lite-1](screenshots/elektraweb/elektraweb-lite-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 2. Elektraweb MINI

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `MINI` |
| **Product ID** | 177 |
| **Страница** | [elektraweb-mini](https://www.elektraweb.com/elektraweb-mini/) |

#### Функциональные блоки (с сайта)

**Küçük Oteller için Kanal Yönetimi İçinde** — Türkiye&rsquo;nin ve dünyanın en iyi otellerinde tercih edilen Elektraweb Otel Yönetim Sistemi, daha kolay ve ekonomik bir versiyonu olan Elektraweb Mini &lsquo;yi küçük ölçekli otellerin kullanımına sunuyor. Elektraweb Mini, online rezervasyon ve kanal yönetimi ile entegre olduğundan otelinizi daha karlı satar ve çok daha kolay yönetirsiniz.

**MİNİ OTEL PROGRAMI** — Türkiye&rsquo;nin ve dünyanın en iyi otellerinde tercih edilen Elektraweb Otel Yönetim Sistemi, daha kolay ve ekonomik bir versiyonu olan Elektraweb Mini &lsquo;yi küçük ölçekli otellerin kullanımına sunuyor. Elektraweb Mini, online rezervasyon ve kanal yönetimi ile entegre olduğundan otelinizi daha karlı satar ve çok daha kolay yönetirsiniz.

- Rezervasyon, check-in, check-out, konaklama, blokaj, folyo, fatura, gün sonu, polis kimlik bildirimi ve maliye raporu işlemlerini gerçekleştirirsiniz

**Elektraweb Mini ile;** — 

- Rezervasyon, check-in, check-out, konaklama, blokaj, folyo, fatura, gün sonu, polis kimlik bildirimi ve maliye raporu işlemlerini gerçekleştirirsiniz
- KBS Bildirimleri ni hatasız ve anlık olarak gerçekleştirebilirsiniz
- KVKK kriterlerine kolayca uyum sağlarsınız
- Konaklama vergisi otomatik olarak faturanıza eklenir
- Faturanızı saniyeler içinde hatasız olarak kesersiniz
- Maliye Listesi, Gün Sonu Raporu vb.ihtiyacınız olan tüm raporları tek tıkla hazırlarsınız
- Günlük Durum raporları her an elinizin altındadır

#### Скриншоты / визуалы

![elektraweb-mini-1](screenshots/elektraweb/elektraweb-mini-1.jpg)

![elektraweb-mini-2](screenshots/elektraweb/elektraweb-mini-2.jpg)

![elektraweb-mini-3](screenshots/elektraweb/elektraweb-mini-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 3. Yapay Zeka Destekli Otel

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `ArtificialIntelligenceIntegration` |
| **Product ID** | 314 |
| **Страница** | [yapay-zeka-destekli-otel-yonetimi](https://www.elektraweb.com/yapay-zeka-destekli-otel-yonetimi/) |

**Назначение:** İtibar Yönetimi Yapay Zeka Entegrasyonu yıllık kullanım ücreti

#### Функциональные блоки (с сайта)

**Yapay Zeka Destekli Otel Yönetimi** — Rezervasyon Asistanı

- Her Dilde Sesli ve yazılı İletişim kurar
- En iyi tarih ve Fiyat Alternatiflerini hazırlar
- Rezervasyon Bilgilerini Eksiksiz Alır
- Ödeme Linki ve Konfirmasyon Gönderir
- 7/24 çalışır
- Misafirlerin taleplerini sesli olarak alır
- İlgili bölüm için görev ataması yapar
- Günlük programlar hakkında anında bilgi verir

#### Скриншоты / визуалы

![yapay-zeka-destekli-otel-yonetimi-1](screenshots/elektraweb/yapay-zeka-destekli-otel-yonetimi-1.png)

![yapay-zeka-destekli-otel-yonetimi-2](screenshots/elektraweb/yapay-zeka-destekli-otel-yonetimi-2.png)

![yapay-zeka-destekli-otel-yonetimi-3](screenshots/elektraweb/yapay-zeka-destekli-otel-yonetimi-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 4. Otel Satış Portalı

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `PORTAL` |
| **Product ID** | 226 |
| **Страница** | [otel-satis-portali](https://www.elektraweb.com/otel-satis-portali/) |

#### Функциональные блоки (с сайта)

**ElektraWeb Otel Satış Portalı Çözümleri** — Zincir oteller için "Merkezi Rezervasyon Portalı" çözümleri içermektedir. Elektraweb Satış Portalı Çözümleri ile işletmeler, çağrı merkezlerinde veya web sitelerinde uçak, tur, transfer hizmetlerini de dinamik olarak paketleyerek, B2B, B2C ve B2E satışlar yapabilme imkanına kavuşurlar.

- Kullanıcı ara yüzü hem çok basit hem de çok fonksiyoneldir
- Tüm oda tipleri ve fiyat opsiyonlarını tek ekranda görebilme kolaylığı sağlar
- Günlük fiyat ve doluluğa aynı ekrandan ulaşılır
- Yapılan indirim ve promosyonlar öne çıkarılabilir
- İletişim talebi, yol tarifi, hava durumu ve online destek özellikleri eklenebilir

- Kullanıcı ara yüzü hem çok basit hem de çok fonksiyoneldir
- Tüm oda tipleri ve fiyat opsiyonlarını tek ekranda görebilme kolaylığı sağlar
- Günlük fiyat ve doluluğa aynı ekrandan ulaşılır
- Yapılan indirim ve promosyonlar öne çıkarılabilir
- İletişim talebi, yol tarifi, hava durumu ve online destek özellikleri eklenebilir
- Yorumlara rezervasyon sayfasından ulaşım imkanı verilebilir
- Değişik oda tipi ve tarihlere aynı ekrandan rezervasyon yapılabilir

#### Скриншоты / визуалы

![otel-satis-portali-1](screenshots/elektraweb/otel-satis-portali-1.jpg)

![otel-satis-portali-2](screenshots/elektraweb/otel-satis-portali-2.png)

![otel-satis-portali-3](screenshots/elektraweb/otel-satis-portali-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 5. Park Otomasyon

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `PARK` |
| **Product ID** | 185 |
| **Страница** | [park-otomasyon-cozumleri](https://www.elektraweb.com/park-otomasyon-cozumleri/) |

**Назначение:** Eptera Park Automation is a cloud based ticketing and access control system for theme parks clubs and beaches. It supports sales payments and barcode or QR or RFID based entry, and it can run membership and prepaid wallet flows in the same platform.

#### Функциональные блоки (с сайта)

**Elektraweb Park / Kulüp / Beach Otomasyon Sistemi** — Eğlence ve tema parkları, kulüpler, beachler, eğlence, kültür, sanat veya spor alanlarının satış, ödeme alma, barkodlu otomatik giriş süreçlerinin yönetilmesini sağlayan otomasyon sistemidir. Üye yönetim sistemleri ile entegre çalıştığından, üye tiplerine göre ön ödeme alma, fiyatlandırma, otomatik geçiş izni, üye bileklik veya kart basımı süreçlerini tek program üzerinden çözü

- Web tabanlı ve bulut yapıdadır; internetin olduğu her yerde hemen kullanıma başlanabilir.
- Sınırsız sayıda giriş turnikesi ve her türlü kart, barkod, QR okuyucusu ile çalışabilir.
- Hızlı ve kolay giriş ekranı ile tekli ve / veya grup biletleri kolayca basılır. Bu biletler kart veya bileklik şeklinde olabilir.
- Basılan kart veya bileklikler Qr (Barkod) veya RF (temassız) teknolojisini kullanabilir.

- Web tabanlı ve bulut yapıdadır; internetin olduğu her yerde hemen kullanıma başlanabilir.
- Sınırsız sayıda giriş turnikesi ve her türlü kart, barkod, QR okuyucusu ile çalışabilir.
- Hızlı ve kolay giriş ekranı ile tekli ve / veya grup biletleri kolayca basılır. Bu biletler kart veya bileklik şeklinde olabilir.
- Basılan kart veya bileklikler Qr (Barkod) veya RF (temassız) teknolojisini kullanabilir.
- Bir grubun tüm üyelerine ayrı kart veya bileklik basılabileceği gibi tüm grup için ortak bir kart / bileklik de basılabilir.
- Ayrı kartlar basılsa bile aileler ve gruplar isterlerse ortak bakiye kullanabilirler.
- İlk kayıt esnasında istenirse ad soyad, telefon numarası gibi bilgiler alınıp üyelik ve CRM çalışması yapılabilir.
- İlk kayıt esnasında ve/veya sonrasında içerideki harcamalar için ayrıca karta para yüklenebilir.
- Turnike ve elektronik kapılardan geçişte bakiye kontrolü yapılır ve giriş ücreti verilen biletin özelliklerine göre karttan düşer.
- Karta yüklenen ekstra bakiyesini ziyaretçiler içerideki satış noktalarında harcayabilir, kendi cep telefonlarından kart bakiyelerini ve ekstrelerin görebilirler. İsterlerse kredi kartı ile online para yükleyebilirler.

#### Скриншоты / визуалы

![park-otomasyon-cozumleri-1](screenshots/elektraweb/park-otomasyon-cozumleri-1.jpg)

![park-otomasyon-cozumleri-2](screenshots/elektraweb/park-otomasyon-cozumleri-2.png)

![park-otomasyon-cozumleri-3](screenshots/elektraweb/park-otomasyon-cozumleri-3.png)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 6. Sistem Entegrasyonları

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `WebService` |
| **Product ID** | 30 |
| **Страница** | [sistem-entegrasyonlari](https://www.elektraweb.com/sistem-entegrasyonlari/) |

**Назначение:** Provides guest identity validation for Wi-Fi access via PMS data.

#### Функциональные блоки (с сайта)

**Sistem Entegrasyonları** — Elektraweb Otel Programı, sistem entegrasyonları sayesinde 3. parti sistemlerle entegre çalışır.

#### Скриншоты / визуалы

![sistem-entegrasyonlari-1](screenshots/elektraweb/sistem-entegrasyonlari-1.jpg)

![sistem-entegrasyonlari-2](screenshots/elektraweb/sistem-entegrasyonlari-2.jpg)

![sistem-entegrasyonlari-3](screenshots/elektraweb/sistem-entegrasyonlari-3.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 7. Fuar Kongre Kayıt

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `ExhibitionandSymposium` |
| **Product ID** | 242 |
| **Страница** | [fuar-ve-sempozyum-dijital-kayit-sistemi](https://www.elektraweb.com/fuar-ve-sempozyum-dijital-kayit-sistemi/) |

#### Скриншоты / визуалы

![fuar-ve-sempozyum-dijital-kayit-sistemi-1](screenshots/elektraweb/fuar-ve-sempozyum-dijital-kayit-sistemi-1.jpg)

![fuar-ve-sempozyum-dijital-kayit-sistemi-2](screenshots/elektraweb/fuar-ve-sempozyum-dijital-kayit-sistemi-2.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 8. Yurt Yönetim Programı

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `Okul` |
| **Product ID** | 322 |
| **Страница** | [yurt-yonetim-programi](https://www.elektraweb.com/yurt-yonetim-programi/) |

#### Функциональные блоки (с сайта)

**Yurt Yönetim Programı** — Opex Yurt Yönetimi Programı , Yurt yönetiminin;

- Konaklayan öğrencilerin sözleşmelerini hazırlayabildiği,
- Öğrencilerin ve ailelerinin bilgilerini kaydedip, ihtiyaç halinde ulaşabilecekleri,
- CRM sistemini yönetebilecekleri,
- Ödeme ve tahsilat süreçlerini takip edebilecekleri,
- Mobil uygulama sayesinde öğrenciler ile 7/24 iletişim halinde kalabildikleri
- Online Anketler yoluyla memnuniyet araştırması yapabildikleri
- Online arıza bildirimi alabildikleri
- Odaların müsaitlik durumlarını tek ekranda izleyebilecekleri

#### Скриншоты / визуалы

![yurt-yonetim-programi-1](screenshots/elektraweb/yurt-yonetim-programi-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 9. Marina Yönetim

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `MARIN` |
| **Product ID** | 284 |
| **Страница** | [marina-yonetim-sistemi](https://www.elektraweb.com/marina-yonetim-sistemi/) |

**Назначение:** Eptera Marina Management System helps marinas manage operations from a single cloud based platform, accessible on web and mobile from any device with internet access.

#### Функциональные блоки (с сайта)

**ELEKTRAWEB Marina Yönetim Sistemi ile Teknelerinizi Yönetin, Süreçleri Dijitalleştirin** — Günümüzün rekabetçi marina işletmeciliğinde başarı; yalnızca iskeleleri doldurmakla değil, operasyonları eksiksiz yönetmek, müşteri memnuniyetini en üst seviyeye taşımak ve finansal sürdürülebilirliği sağlamakla ölçülüyor.

- Tekneler & Müşteri Profilleri: Her tekne ve sahibine ait tüm bilgiler eksiksiz kayıt altına alınır.
- Sözleşme & Rezervasyon: Uzun ve kısa dönemli bağlama sözleşmeleri, fiyatlandırma ve rezervasyon süreçleri kusursuz yönetilir.
- Giriş&ndash;Çıkış & Seyir: Tüm hareketler kayıt altında tutularak şeffaflık ve güvenlik sağlanır.
- Muhasebe & Finans: Gelir-gider, faturalama, tahsilat ve POS entegrasyonlarıyla finansal disiplin güçlendirilir.
- Bakım & İş Emirleri: Teknik bakım, stok ve iş gücü yönetimi tek noktadan kontrol edilerek sorumluluk gerektiren işler güvence altına alınır.

#### Скриншоты / визуалы

![marina-yonetim-sistemi-1](screenshots/elektraweb/marina-yonetim-sistemi-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 10. Tedarik Portalı

| | |
|---|---|
| **Категория** | Diğer |
| **Страница** | [tedarik-portali](https://www.elektraweb.com/tedarik-portali/) |

#### Функциональные блоки (с сайта)

**Tedarikçi Portalı ile İşinizi Yükseltin!** — Zamanınız kıymetli, bütçeniz önemli ve iş süreçlerinizin verimli olması gerekiyor. Tedarikçi portalımız ile tüm bu ihtiyaçlarınıza kolayca çözüm bulabilirsiniz. Hızlı, güvenilir, esnek ve ekonomik alımlar için hemen bizimle çalışmaya başlayın!

#### Скриншоты / визуалы

![tedarik-portali-1](screenshots/elektraweb/tedarik-portali-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 11. Premium Sunucu

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `PremiumServerforPMS` |
| **Product ID** | 300 |
| **Страница** | [premium-sunucu-hizmeti](https://www.elektraweb.com/premium-sunucu-hizmeti/) |

#### Скриншоты / визуалы

![premium-sunucu-hizmeti-1](screenshots/elektraweb/premium-sunucu-hizmeti-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 12. Google Yedekleme

| | |
|---|---|
| **Категория** | Diğer |
| **Код (API)** | `BackupforPMS` |
| **Product ID** | 298 |
| **Страница** | [google-yedekleme](https://www.elektraweb.com/google-yedekleme/) |

#### Скриншоты / визуалы

![google-yedekleme-1](screenshots/elektraweb/google-yedekleme-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

### 13. Viofun

| | |
|---|---|
| **Категория** | Diğer |
| **Страница** | [viofun](https://www.elektraweb.com/viofun/) |

#### Скриншоты / визуалы

![viofun-1](screenshots/elektraweb/viofun-1.jpg)

#### Что клонировать (чеклист для Nafta)

- [ ] Модель данных и CRUD
- [ ] UI-экраны и отчёты
- [ ] Интеграции с ядром PMS
- [ ] Права доступа (RBAC)
- [ ] Мобильная версия (если применимо)

---

## 7. Интеграции и API

> Отдельная политика: [1 EUR/номер/год](https://www.elektraweb.com/en/api-integrations), min 120 EUR/год.

#### Платежи: Sanal Pos Entegrasyonu

### Sanal Pos Entegrasyonu (`VirtualPOSIntegration`)

The guest's accommodation charges or additional in-room expenses are automatically applied to the folio through a swiftly and securely delivered payment link. To facilitate this module, integration with a virtual point of sale (POS) is essential.


#### Платежи: Yazarkasa Entegrasyonu

### Yazarkasa Entegrasyonu (`CashRegisterIntegration`)

İlk Yıl Kurulum ücreti ilave edilir

- Разовая установка: 50 EUR

#### Доступ: Kapı Kilit Entegrasyonu

### Kapı Kilit Entegrasyonu (`DoorLockIntegration`)

Automates mobile and keyless access, improving security and check-in speed.


#### Коммуникации: Santral Entegrasyonu

### Santral Entegrasyonu (`TelephoneSwitchboardIntegration`)

API required for your PBX system to communicate with the Eptera software


#### Коммуникации: IP Santral

### IP Santral (`IPSwitchboard`)

- Лицензирование: USERPRICE 2 EUR/пользователь/мес

#### Коммуникации: Whatsapp Entegrasyonu

### Whatsapp Entegrasyonu (`WhatsappIntegration`)

Enables personalized WhatsApp communications with template messages and automated workflows (requires CRM).


#### API: Booking Api

### Booking Api (`BookingAPI`)


#### API: Rezervasyon Api

### Rezervasyon Api (`ReservationAPI`)


#### API: CRM Api

### CRM Api (`CRMAPI`)


#### API: ERP Api

### ERP Api (`ERPAPI`)


#### API: Task Manager Api

### Task Manager Api (`TaskManagerAPI`)


#### API: Call Center Api

### Call Center Api (`CallCenterAPI`)


#### API: Hotspot Api

### Hotspot Api (`HotspotApi`)

API Access for External Hotspot Software


#### API: Web Servis

### Web Servis (`WebService`)

Provides guest identity validation for Wi-Fi access via PMS data.


#### Каналы: Kanal Yöneticisi Entegrasyonu

### Kanal Yöneticisi Entegrasyonu (`ChannelManagerIntegration`)


#### ERP: Muhasebe Entegrasyonu

### Muhasebe Entegrasyonu (`AccountingIntegration`)


#### In-room: iP / Pay Tv Entegrasyonu

### iP / Pay Tv Entegrasyonu (`iP/PayTvIntegration`)


#### In-room: Isıtma Soğutma Entegrasyonu

### Isıtma Soğutma Entegrasyonu (`HeatingandCoolingIntegration`)


#### POS: POS Sepet Entegrasyonları

### POS Sepet Entegrasyonları (`FoodCartIntegration`)

Entegrasyon yapılan firma adeti kadar lisans alınmalıdır. ( Getir Yemek , Yemek Sepeti , Migros Yemek , Trendyol Yemek)


#### Compliance TR: KTM Api

### KTM Api (`Ktmapi`)

Konaklama Tesisleri Merkezi Turizm Veritabanı Api


## 8. Мобильные приложения

### Elektra Manager (Mobil Uygulama) (`ElektraManager(MobileApp)`)

Eptera Manager Mobile App provides mobile access to operational and financial insights, plus key managerial reports.

- Лицензирование: USERPRICE 8.33333 EUR/пользователь/мес

### Elektra Operator (Mobil Uygulama) (`ElektraOperator(MobileApp)`)

Eptera Operator Mobile App for staff to input, view, and manage operational data from security, technical, and housekeeping teams.

- Лицензирование: USERPRICE 8.33333 EUR/пользователь/мес

### Misafir Mobil Uygulama ( Generic) (`GuestMobileApplication(SuperAssistant)`)

Guest Generic Mobile Application is a ready to use guest mobile app with standard features. It is not published under a specific hotel name and it is not branded for a single property. It covers core functions like guest messaging, service requests, and basic reservation related flows.


### Misafir Mobil Uygulama ( Otele Özel) (`GuestMobileApplication(HotelSpecific)`)

Hotel specific mobile app (published for the hotel) is prepared for one specific hotel and published under the hotel’s name. If preferred, it can also be published under the hotel’s own Google Play and Apple App Store developer accounts. On the guest side, the hotel identity is visible and the app works as a digital extension of the property.

- Разовая установка: 5000 EUR

### Mobil Kimlik Okur ve Check-in Standart (`SmartIDReaderStandard`)

Eptera Standart Smart ID Reader is a mobile solution that lets hotels scan guest IDs and passports instantly using a phone or tablet camera, and transfer the details directly into the PMS. It includes up to 1,000 scans per month.

- Лицензирование: USERPRICE 10 EUR/пользователь/мес

### Mobil Kimlik Okur ve Check-in Pro (`SmartIDReaderPro`)

Eptera Smart ID Reader & Check-in Pro is a mobile solution that scans guest IDs and passports using a phone or tablet camera and transfers the data directly into the PMS. It enables a faster and fully contactless check in flow for front desk teams. Unlimited scans are included.

- Лицензирование: USERPRICE 20 EUR/пользователь/мес

### İnsan Kaynakları Personel Portalı (Mobil Uygulama) (`IKPP`)

The HR mobile app lets companies manage HR workflows together with quality management and audit processes from a single mobile platform. This improves operational efficiency while also supporting employee engagement and organizational transparency.


### Stok Mobil Uygulama (Barkodlu) (`StockMobileApplication(Barcode)`)

Eptera Stock Mobile Application (Barcode) integrates with the ERP and is mainly used during stock counts with a barcode scanner device. It supports core inventory actions such as transfers, wastage entries, barcode assignment, barcode label printing, and delivery note workflows.

- Лицензирование: USERPRICE 2 EUR/пользователь/мес

### Demirbaş ( Barkodlu) Mobil Uygulama (`FixedAsset(Barcode)MobileApplication`)

Eptera Fixed Asset (Barcode) Mobile Application is the barcode based version of our fixed assets solution, enabling asset identification and tracking via barcode labels and scanner devices.

- Лицензирование: USERPRICE 2 EUR/пользователь/мес

### Demirbaş ( RFiD ) Mobil Uygulama (`Fixtures(RFiD)MobileApplication`)

Eptera Fixtures (RFID) Mobile Application is the RFID based version of our fixed assets solution, enabling asset identification and tracking via RFID instead of barcodes.

- Лицензирование: USERPRICE 40 EUR/пользователь/мес
- Разовая установка: 1500 EUR

### Check In Kiosk (`CheckInKiosk`)

Eptera Check-in Kiosk is a self service check in solution that lets guests complete check in within minutes from a kiosk tablet placed in the lobby, bar, or any convenient area.

- Лицензирование: USERPRICE 20 EUR/пользователь/мес

### Online Check in (`OnlineCheckin`)

Eptera Online Check-in reduces front desk workload by letting guests complete check-in from their own phone.

- Документация/сайт: https://www.elektraweb.com/misafir-uygulamasi/

### Denetim Yönetimi (Mobil Uygulama) (`DYY`)


### QR PDKS Uygulaması (`QRPdksAPP`)


## 9. Kalite Yönetimi (QM) — подмодули

Полный пакет **QM** (Kalite ve Doküman Yönetimi) или отдельные подмодули:

- **Doküman Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Denetim Yönetimi** — 
- **DOIF Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **İnsan Kaynakları Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Strateji ve Süreç Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Eğitim Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Ölçme ve Değerlendirme** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Proje ve Risk Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Tedarikçi Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Mevzuat Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Ekipman ve Bakım Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Performans Değerlendirme** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Karbon Ayak İzi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Su Ayak İzi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **GSTC Sertifikasyonu** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo
- **Kampanya Yönetimi** — Eptera Quality and Document Management is a web and cloud based system for managing quality workflows, audits, and corpo

---

## 10. Служебные SKU и hardware

Разовые/сервисные позиции (не функциональные модули, но встречаются в контракте):

- Toplantı
- Market (Barkod Okuma Dahil)
- Data Barındırma Bedeli
- Data Barındırma Bedeli Kurulumu
- Yazarkasa Entegrasyonu — install 50 EUR
- Hotspot Hotel — install 150 EUR
- iDealPBX IP Santral
- Yedekleme PMS
- Yedekleme ERP
- GIATA Drive
- Özel Tasarım Websitesi — install 1500 EUR
- Mikrotik Router 201 - 500 (RB1100) — install 320 EUR
- Okul — install 1000 EUR
- ElektraHotels Portalı — install 3600 EUR
- Mini Muhasebe/Başlangıç Paketi
- Yazıcı Kurulumu
- Eğitim Yönetimi
- Online Rezervasyon
- Kanal Yöneticisi
- Terazi Üretim Entegrasyonu — install 100 EUR
- Turnike Entegrasyonu — install 100 EUR
- Api Kurulum ve Kurgu Desteği — install 1500 EUR
- Ota Connection Fee — install 3000 EUR
- Integration with Taxman Fiscal Reporting
- Integration with Hoteza Ip Tv
- Self Kioks
- Yazılım Geliştirme — install 120 EUR
- Veri Aktarımı — install 1000 EUR
- Eğitim Saat Ücreti — install 30 EUR
- Yerinde Eğitim Şehir Dışı — install 150 EUR
- Tek Seferlik Kurulum ve Eğitim Ücreti — install 75 EUR
- Yerinde Eğitim Şehir İçi — install 100 EUR
- Yerinde Eğitim Yarım Gün — install 60 EUR
- Lokal Kurulum
- Ofis İçi Eğitim
- Kurulum Saat Ücreti — install 30 EUR
- KBS Kurulumu
- Yazıcı Kurulumu (Printer Service)
- Yazarkasa Kurulumu — install 50 EUR
- Santral Kurulumu

---

## 11. Полный реестр API (174 SKU)

| ID | CODE | Название | EN описание |
|----|------|----------|-------------|
| 5 | PMS | Ön Büro Yönetimi | Efficiently handles front office operations, reservations, housekeeping, folios, |
| 272 | ChannelManager&BookingEngine | Kanal Yönetimi & Online Rezervasyon | Synchronizes availability, rates, and reservations with online channels in real  |
| 17 | E-InvoiceIntegration | E-Uygulama | Eptera lets you manage e-Invoice e-Archive e-Delivery Note and e-Ledger processe |
| 16 | ACC | Muhasebe | A modern corporate accounting system unifies financial operations—general ledger |
| 14 | STOCK | Stok | Provides real-time procurement, inventory, cost control, stock levels, and purch |
| 7 | POS | Pos | Seamlessly integrates with PMS and inventory, enabling automatic posting to gues |
| 271 | VirtualPOSIntegration | Sanal Pos Entegrasyonu | The guest's accommodation charges or additional in-room expenses are automatical |
| 21 | CashRegisterIntegration | Yazarkasa Entegrasyonu | İlk Yıl Kurulum ücreti ilave edilir |
| 302 | SmartIDReaderStandard | Mobil Kimlik Okur ve Check-in Standart | Eptera Standart Smart ID Reader is a mobile solution that lets hotels scan guest |
| 315 | SmartIDReaderPro | Mobil Kimlik Okur ve Check-in Pro | Eptera Smart ID Reader & Check-in Pro is a mobile solution that scans guest IDs  |
| 50 | HR | İnsan Kaynakları | Centralizes employee data, documents, approvals, leave tracking, and internal co |
| 33 | İsafe | iSafe | 5651 Sayılı Kanuna Göre Loglama, Güvenlik Duvarı, URL Filtreleme, VPN (Sanal Öze |
| 19 | Procurement | Satın Alma | Eptera Procurement Software streamlines the full purchasing cycle from departmen |
| 18 | FixedAsset | Demirbaş | Tracks assets, amortization, barcode labeling, usage history, loss/waste, and ve |
| 15 | F&B | Üretim | Eptera Production, Recipes & Costing helps hotels and restaurants manage ingredi |
| 34 | DMENU | Digital Menü |  |
| 305 | DigitalMenu | Akıllı Digital Menü | Displays interactive menus, supports direct ordering, upselling, and multi-langu |
| 255 | HotspotHotel | Hotspot Hotel | İlk Yıl Tek seferlik Kurulum ücreti eklenir |
| 11 |  | iDealPBX IP Santral |  |
| 298 | BackupforPMS | Yedekleme PMS |  |
| 299 | BackupforERP | Yedekleme ERP |  |
| 300 | PremiumServerforPMS | Premium Sunucu PMS |  |
| 56 |  | GIATA Drive |  |
| 301 | PremiumServerforERP | Premium Sunucu ERP |  |
| 20 | TaskManagement | Görev Yönetimi | Automates and monitors operational tasks across departments, ensuring timely com |
| 41 | CRM | CRM ve Sadakat | Enhances guest engagement through automation, personalized communication, loyalt |
| 287 | ElektraManager(MobileApp) | Elektra Manager (Mobil Uygulama) | Eptera Manager Mobile App provides mobile access to operational and financial in |
| 288 | ElektraOperator(MobileApp) | Elektra Operator (Mobil Uygulama) | Eptera Operator Mobile App for staff to input, view, and manage operational data |
| 12 | SPA | Spa ve Klup Üyelik | Schedules rooms and staff, tracks sales and commissions, manages payments, and s |
| 8 | SalesMarketing | Satış Pazarlama | Manages events, groups, weddings, and banquets with resource booking, staff cale |
| 35 | PredesignedWebsite | Standart Web Sitesi |  |
| 186 | CustomDesignWebsite(IncludingSSL) | Özel Tasarım Websitesi | Özel Tasarım veya Bilet Satış Portalı |
| 10 | CALL | Çağrı Merkezi | Supports centralized reservation handling with CRM insights that automatically d |
| 43 | WhatsappIntegration | Whatsapp Entegrasyonu | Enables personalized WhatsApp communications with template messages and automate |
| 26 | AccountingIntegration | Muhasebe Entegrasyonu |  |
| 27 | iP/PayTvIntegration | iP / Pay Tv Entegrasyonu |  |
| 22 | DoorLockIntegration | Kapı Kilit Entegrasyonu | Automates mobile and keyless access, improving security and check-in speed. |
| 273 | ReputationManagement | İtibar Yönetimi | Aggregates online reviews, analyzes sentiment with AI, and delivers actionable i |
| 259 |  | Mikrotik Router 201 - 500 (RB1100) | tek seferlik ücretlendirilir |
| 296 | DynamicPricing | Dinamik Fiyatlandırma | Dynamic Pricing allows hotels to automatically update room rates based on occupa |
| 262 | GuestMobileApplication(SuperAssistant) | Misafir Mobil Uygulama ( Generic) | Guest Generic Mobile Application is a ready to use guest mobile app with standar |
| 268 | GuestMobileApplication(HotelSpecific) | Misafir Mobil Uygulama ( Otele Özel) | Hotel specific mobile app (published for the hotel) is prepared for one specific |
| 265 | IKPP | İnsan Kaynakları Personel Portalı (Mobil Uygu | The HR mobile app lets companies manage HR workflows together with quality manag |
| 312 | QRPdksAPP | QR PDKS Uygulaması |  |
| 264 | DYY | Denetim Yönetimi (Mobil Uygulama) |  |
| 322 | Okul | Okul |  |
| 226 | PORTAL | ElektraHotels Portalı |  |
| 324 |  | Mini Muhasebe/Başlangıç Paketi | Basic finance, purchase, and stock management for small properties. |
| 185 | PARK | Park Otomasyonu | Eptera Park Automation is a cloud based ticketing and access control system for  |
| 28 | StockMobileApplication(Barcode) | Stok Mobil Uygulama (Barkodlu) | Eptera Stock Mobile Application (Barcode) integrates with the ERP and is mainly  |
| 285 | HotspotApi | Hotspot Api | API Access for External Hotspot Software |
| 274 | Development(CarbonNotr) | Karbon Nötrleme | Eptera Carbon Offsetting module calculates the carbon footprint of a guest stay, |
| 191 | HK | Kat Hizmetleri |  |
| 32 | ID&PassportScanner | Kimlikokur | Eptera ID & Passport Scanner scans passports and ID cards, saves them as image a |
| 184 |  | Yazıcı Kurulumu |  |
| 263 | QM | Kalite ve Doküman Yönetimi Tüm Paket | Eptera Quality and Document Management is a web and cloud based system for manag |
| 306 | DigitalMenu | Restoran Rezervasyon |  |
| 334 | QM | Doküman Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 335 | QM | Denetim Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 336 | QM | DOIF Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 337 | QM | İnsan Kaynakları Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 338 | QM | Strateji ve Süreç Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 339 | QM | Eğitim Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 340 | QM | Ölçme ve Değerlendirme Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 341 | QM | Proje ve Risk Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 342 | QM | Tedarikçi Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 343 | QM | Mevzuat Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 344 | QM | Ekipman ve Bakım Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 345 | QM | Performans Değerlendirme | Eptera Quality and Document Management is a web and cloud based system for manag |
| 346 | QM | Karbon Ayak İzi Hesaplama | Eptera Quality and Document Management is a web and cloud based system for manag |
| 347 | QM | Su Ayak İzi Hesaplama | Eptera Quality and Document Management is a web and cloud based system for manag |
| 348 | QM | GSTC Sertifikasyonu | Eptera Quality and Document Management is a web and cloud based system for manag |
| 349 | QM | Kampanya Yönetimi | Eptera Quality and Document Management is a web and cloud based system for manag |
| 314 | ArtificialIntelligenceIntegration | Yapay Zeka Entegrasyonu | İtibar Yönetimi Yapay Zeka Entegrasyonu yıllık kullanım ücreti |
| 267 | AdditionalTerminalLicense(PosorSPA) | Ek Terminal Lisansı (Pos veya SPA) |  |
| 246 | BiorderApp | Bisipariş |  |
| 325 | EYEiCY | Yiyecek İçecek |  |
| 244 | BookingAPI | Booking Api |  |
| 303 | CheckInKiosk | Check In Kiosk | Eptera Check-in Kiosk is a self service check in solution that lets guests compl |
| 307 | CallCenterAPI | Call Center Api |  |
| 308 | CRMAPI | CRM Api |  |
| 309 | ERPAPI | ERP Api |  |
| 277 | GuestMobileAppHotelSpecificDevelopment | Misafir Mobil Uygulama Tek Seferlik Otele Öze | Guest Mobile App Hotel Specific Development applies when the hotel already has t |
| 254 | FixedAsset(Barcode)MobileApplication | Demirbaş ( Barkodlu) Mobil Uygulama | Eptera Fixed Asset (Barcode) Mobile Application is the barcode based version of  |
| 310 | TaskManagerAPI | Task Manager Api |  |
| 311 | ReservationAPI | Rezervasyon Api |  |
| 266 | Fixtures(RFiD)MobileApplication | Demirbaş ( RFiD ) Mobil Uygulama | Eptera Fixtures (RFID) Mobile Application is the RFID based version of our fixed |
| 227 | EHWS | ElektraHotels Web Servis |  |
| 228 | UWSY | Uçak WebServis |  |
| 229 | BWSY | Bilet WebServis |  |
| 293 | EasyResAPI | Kolay Rez Api |  |
| 252 | TOY | Tur Operatörü | Transfers bookings directly from offline agency extranets into the PMS with cont |
| 127 | ChannelManagerIntegration | Kanal Yöneticisi Entegrasyonu |  |
| 249 | SocialMediaIntegration | Sosyal Medya Entegrasyonu |  |
| 320 | GMP3Service | GMP3 Service (inpos) |  |
| 30 | WebService | Web Servis | Provides guest identity validation for Wi-Fi access via PMS data. |
| 333 | Ktmapi | KTM Api | Konaklama Tesisleri Merkezi Turizm Veritabanı Api |
| 44 | CommoIntg | Kommo Entegrasyonu |  |
| 25 | TelephoneSwitchboardIntegration | Santral Entegrasyonu | API required for your PBX system to communicate with the Eptera software |
| 178 | PropertyOwner | Ev Sahibi | Eptera Property Owner module is designed for management companies that operate a |
| 171 |  | Online Rezervasyon |  |
| 29 | HeatingandCoolingIntegration | Isıtma Soğutma Entegrasyonu |  |
| 172 |  | Kanal Yöneticisi |  |
| 261 | IPSwitchboard | IP Santral |  |
| 313 | FoodCartIntegration | POS Sepet Entegrasyonları | Entegrasyon yapılan firma adeti kadar lisans alınmalıdır. ( Getir Yemek , Yemek  |
| 270 | ScaleIntegrationforProduction | Terazi Üretim Entegrasyonu | Yıllık entegrasyon bedeline ilave olarak ilk yıl için cihaz başına kurulum ücret |
| 239 | Timeshare | Devre Tatil | Eptera Timeshare module simplifies hotel operations with contract management, an |
| 177 | MINI | Mini |  |
| 187 | TurnstileIntegration | Turnike Entegrasyonu | İlk yıl için cihaz başına kurulum ücreti ayrıca eklenir |
| 294 | APIinstallationandeditingsupport | Api Kurulum ve Kurgu Desteği |  |
| 182 | MUPY | Masa Üstü Programı |  |
| 193 | IKME | IK - Muhasebe Entegrasyonu |  |
| 316 | CustomerOrder | Müşteri Siparişi |  |
| 317 | OtaİntegrationApi | Ota Integration Api |  |
| 318 | OtaConnectionFee | Ota Connection Fee |  |
| 327 |  | Integration with Taxman Fiscal Reporting |  |
| 328 |  | Integration with Hoteza Ip Tv |  |
| 329 |  | Self Kioks |  |
| 295 | AgencyLoyaltyModule+BookingPortal | Acente Sadakat Modülü+ Booking Portal |  |
| 238 | ProjectManagement | Proje Yönetimi |  |
| 286 | DevelopmentAnnual | Yazılım Geliştirme Yıllık |  |
| 248 | Development | Yazılım Geliştirme |  |
| 31 | DataTransfer | Veri Aktarımı |  |
| 131 | 1HourExtraTraining | Eğitim Saat Ücreti |  |
| 170 | TrainingOnSite | Yerinde Eğitim Şehir Dışı |  |
| 330 | Onetimesetupntrain | Tek Seferlik Kurulum ve Eğitim Ücreti | One-Time Setup & Training Fee |
| 220 | TrainingOnSite(inCity) | Yerinde Eğitim Şehir İçi |  |
| 221 | TrainingOnSite(inCity)1/2Days | Yerinde Eğitim Yarım Gün |  |
| 230 | BPY | Bilet Portalı |  |
| 231 | UPY | Uçak Portalı |  |
| 173 | ControlsAfterMigration | Aktarım Sonrası Kontrol |  |
| 174 | DemoForMini | Demo For Mini |  |
| 180 | DY | DEMO |  |
| 281 | EPDY | Eptera PMS Demo |  |
| 278 | MedicalRegistration | Medikal Kayıt |  |
| 188 | LKY | Lokal Kurulum |  |
| 189 | TecnicalServices | Teknik Servis |  |
| 236 | OIEY | Ofis İçi Eğitim |  |
| 130 | KSUY | Kurulum Saat Ücreti |  |
| 192 | KBSK | KBS Kurulumu |  |
| 195 | YKP | Yazıcı Kurulumu (Printer Service) |  |
| 196 | YKY | Yazarkasa Kurulumu |  |
| 197 | SwitchboardInstallation | Santral Kurulumu |  |
| 245 |  | SQL Yedekleme |  |
| 38 | HSP4 | Hotspot Server 4 Port | tek seferlik ücretlendirilir |
| 39 | HSP6 | Hotspot Server 6 Port | tek seferlik ücretlendirilir |
| 40 | ID&PassportScannerA6Size | Kimlikokur A6 Tarayıcı | tek seferlik ücretlendirilir |
| 175 | IDReaderSwipeDevice(MRZ) | Kimlik Okur Swipe Cihazı (MRZ) | Tek Seferlik Ücretlendirilir |
| 256 | MRH | Mikrotik Router 1 - 100 (HAPac2) | HAPac2 model . Tek seferlik ücretlendirilir |
| 258 | MRR | Mikrotik Router 101 - 200 (RB4011) | tek seferlik ücretlendirilir |
| 283 | MR1 | Mikrotik Router 201 - 500 (RB1100AHx4) | tek seferlik ücretlendirilir |
| 260 | MRC | Mikrotik Router 500+ (CCR2116) | tek seferlik ücretlendirilir |
| 323 |  | Eptera Boutique | Eptera Boutique is a cloud-native PMS for small boutique hotels with up to 50 ro |
| 247 | Security | Giriş ve Güvenlik |  |
| 282 | OnlineCheckin | Online Check in | Eptera Online Check-in reduces front desk workload by letting guests complete ch |
| 253 |  | SQL Data SYNC |  |
| 279 | WhatsappTopUp | Whatsapp Kontör |  |
| 243 | TEFK | Turkcell 1000 e_Fatura Kontör |  |
| 240 | TEFK10 | Turkcell 10.000 e_Fatura Kontör |  |
| 241 | TEAK | Turkcell 1.000 e_Arşiv Kontör |  |
| 284 | MARIN | Marina Yönetimi | Eptera Marina Management System helps marinas manage operations from a single cl |
| 242 | ExhibitionandSymposium | Fuar ve Sempozyum |  |
| 321 | Golf | Golf |  |
| 222 | EK1A | Efinans Kontör 1000 Adet |  |
| 297 | TIKY | Turkcell 1000 e_İrsaliye Kontör |  |
| 223 | EK5A | Efinans Kontör 5000 Adet |  |
| 224 | EK10A | Efinans Kontör 10000 Adet |  |
| 225 | EK30A | Efinans Kontör 30000 Adet |  |
| 9 | Etemassizmu | Temassız Misafir Uygulaması Web |  |
| 331 |  | Toplantı |  |
| 332 |  | Market (Barkod Okuma Dahil) |  |
| 350 |  | Data Barındırma Bedeli |  |
| 351 |  | Data Barındırma Bedeli Kurulumu |  |

---

## 12. Приоритеты клонирования для Nafta

Учитывая текущий контракт ~5000 EUR/год, типичный набор Nafta, вероятно:

| Фаза | Модули | Зачем |
|------|--------|-------|
| **MVP** | PMS (все подмодули §3), Channel+Booking, базовые отчёты | Замена ежедневной работы reception |
| **v1** | POS, Stok, Muhasebe, e-Fatura (если TR) | F&B и закупки |
| **v2** | CRM, Call Center, Guest App, Online Check-in | Продажи и гость |
| **v3** | API marketplace, partner portal | Перепродажа (ваша цель) |
| **Опционально** | Hotspot/KBS/Kimlik — только если рынок Турция | Compliance |

**Рекомендация:** проведите workshop с Nafta — выгрузите список активных модулей из их `app.elektraweb.com` (настройки лицензий) и сопоставьте с этим каталогом.

