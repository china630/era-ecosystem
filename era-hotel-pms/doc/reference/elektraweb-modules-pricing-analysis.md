# Elektraweb: анализ модулей, функционала и ценообразования

> **Дата исследования:** 20 мая 2026  
> **Источники:** [официальный прайс-конфигуратор](https://www.elektraweb.com/elektraweb-fiyat-listesi/#offerapp), публичный API priceapi, маркетинговые страницы модулей, [страница API-интеграций](https://www.elektraweb.com/en/api-integrations)  
> **Проект:** подготовка к возможному клону PMS для заказчика **Nafta**

---

## Краткое резюме

Elektraweb (Talya Bilişim) — облачная web-based PMS + ERP экосистема для отелей, ресторанов, SPA, госучреждений. **174** позиции в прайс-API, **105** отображаются в публичном конфигураторе. Цены в конфигураторе номинированы в **EUR** (месячная ставка × 12 × период). Для рынка Турции доступны пакеты **Mini / Midi / Standart** с коэффициентами 0.25 / 0.5 / 1.0.

**Ключевой вывод для Nafta:** публичный прайс полностью восстанавливается из `https://www.elektraweb.com/priceapi/getapi.php` без прохождения Cloudflare Turnstile (защита только на iframe `teklifapp`).

---

## 1. Политика ценообразования

### 1.1 Архитектура прайса

| Элемент | Описание |
|---------|----------|
| **Конфигуратор** | Angular-приложение [/teklifapp/](https://www.elektraweb.com/teklifapp/) в iframe на [странице прайса](https://www.elektraweb.com/elektraweb-fiyat-listesi/#offerapp) |
| **API данных** | GET https://www.elektraweb.com/priceapi/getapi.php?type=packet|period|product |
| **Валюта** | EUR (месячные ставки ROOMPRICE / BASEPRICE) |
| **Налоги** | Опционально TAXPERCENT / INSTALLATION_TAXPERCENT на отдельные позиции |
| **Рынки** | Yurt İçi (TR) / Yurt Dışı (ABROAD) — переключатель в приложении |

### 1.2 Формула расчёта (из JS-бандла teklifapp)

Для выбранного модуля при `USEFACTOR = true` (большинство PMS/ERP):

```
room_part = room_count × ROOMPRICE × packet_factor
if room_part < MINPRICE: room_part = MINPRICE
monthly = room_part + BASEPRICE + (USERPRICE × user_count)
annual = 12 × monthly × period_factor × (1 - discount%)
+ INSTALLATIONFEE (разово, с возможной надбавкой INSTALLATION_TAXPERCENT)
```

При `USEFACTOR = false` коэффициент пакета **не применяется** (`packet_factor = 1`).

### 1.3 Пакеты (packet)

| Пакет | FACTOR | Назначение (по логике UI) |
|-------|--------|-------------------------|
| **Mini** | 0.25 | Экономичный; **включает** online rezervasyon + kanal yönetimi (по подсказке в конфигураторе) |
| **Midi** | 0.5 | Средний; рекомендуется при 31–50 номерах вместо Mini |
| **Standart** | 1 | Полный PMS; рекомендуется по умолчанию |
| **NoPms** | 0.5 | ERP/каналы без полного PMS (фикс. 100 номеров в UI) |

**Правила UI:**
- При **>50 номерах** пакет Mini **недоступен** (автопереключение на Standart).
- При **31–50 номерах** и Mini — всплывающая рекомендация перейти на Midi.
- При выборе **PMS + Mini**: модуль Kanal Yönetimi & Online Rezervasyon (ID 272) может быть **0 EUR** (акция в коде).

### 1.4 Периоды подписки (period)

| Период | PERIODFACTOR | Скидка vs 12×1 год |
|--------|--------------|-------------------|
| 1 Yıl | 1 | базовый |
| 2 Yıl | 1.9 | многолетний коэфф. (не линейно: 2 года = 1.9, не 2.0) |
| 3 Yıl | 2.5 | многолетний коэфф. (не линейно: 2 года = 1.9, не 2.0) |
| 4 Yıl | 3.3 | многолетний коэфф. (не линейно: 2 года = 1.9, не 2.0) |
| 5 Yıl | 4 | многолетний коэфф. (не линейно: 2 года = 1.9, не 2.0) |
| 6 Ay | 0.7 | 6 мес. = 70% от годовой суммы |

> **Важно:** PERIODFACTOR умножает **годовую** сумму целиком, а не даёт «2 года по цене 1.9 года» в прямом смысле — это дисконтный множитель за предоплату.

### 1.5 Отдельные политики

| Тип | Условие |
|-----|---------|
| **API-интеграции** | [1 EUR / номер / год](https://www.elektraweb.com/en/api-integrations), минимум **120 EUR/год** |
| **Гособр. кампания** | [Kampanya](https://www.elektraweb.com/kampanya): Web+Mobil для öğretmenevi — **1000 TL / номер** (вне API, индивидуальный контракт) |
| **Eptera Boutique** | До 50 номеров: **0.5 EUR/номер/мес** + MIN 25 EUR/мес; опционально mini-muhasebe +20 EUR/мес |
| **Разовые услуги** | Kurulum, eğitim, veri aktarımı, hardware (Mikrotik, Kimlikokur scanner) — через INSTALLATIONFEE |
| **POS-терминалы** | USERPRICE за доп. терминал (POS: 4 EUR/мес за терминал) |

### 1.6 Примеры расчёта (Standart, 30 номеров, 1 год)

| Модуль | EUR/мес | EUR/год |
|--------|---------|---------|
| PMS | 72 | 864 |
| ChannelManager&BookingEngine | 30 | 360 |
| POS | 30 | 360 |
| ACC | 22 | 264 |
| STOCK | 16 | 192 |
| CRM | 16 | 192 |
| CALL | 26 | 312 |
| SPA | 30 | 360 |
| **PMS + Channel (базовый отель)** | — | **1224** |

---

## 2. Каталог модулей по разделам сайта

### 2.1 Otel (отель / PMS)

| Модуль | CODE | Описание | ROOM €/мес | BASE €/мес | MIN €/мес | Год (30 ном.) |
|--------|------|----------|------------|------------|-----------|---------------|
| Ön Büro Modülü | `PMS` | Efficiently handles front office operations, reservations, housekeeping, folios, billing,  | 2.4 | 0 | 30 | **864** |
| Online Rezervasyon + Kanal | `ChannelManager&BookingEngine` | Synchronizes availability, rates, and reservations with online channels in real time, supp | 1 | 0 | 15 | **360** |
| Satış ve Banket | `SalesMarketing` | Manages events, groups, weddings, and banquets with resource booking, staff calendars, and | 0.1 | 10 | 0 | **156** |
| Acente Bonus | `AgencyLoyaltyModule+BookingPortal` | — | 0 | 291.66667 | 0 | **3500** |
| Tur Operatörü | `TOY` | Transfers bookings directly from offline agency extranets into the PMS with controlled dat | 0.33 | 0 | 0 | **118.8** |
| Kimlikokur | `ID&PassportScanner` | Eptera ID & Passport Scanner scans passports and ID cards, saves them as image and text, a | 0.1 | 20 | 0 | **276** |
| Hotspot | `HotspotHotel` | İlk Yıl Tek seferlik Kurulum ücreti eklenir | 0.125 | 25 | 0 | **345** |
| Çağrı Merkezi | `CALL` | Supports centralized reservation handling with CRM insights that automatically display cal | 0.2 | 20 | 0 | **312** |
| Mobil Kimlik (Standart) | `SmartIDReaderStandard` | Eptera Standart Smart ID Reader is a mobile solution that lets hotels scan guest IDs and p | 0 | 10 | 0 | **240** |
| Check-in Kiosk | `CheckInKiosk` | Eptera Check-in Kiosk is a self service check in solution that lets guests complete check  | 0 | 20 | 0 | **480** |
| Dinamik Fiyatlandırma | `DynamicPricing` | Dynamic Pricing allows hotels to automatically update room rates based on occupancy levels | 0.2 | 0 | 20 | **240** |
| CRM ve Sadakat | `CRM` | Enhances guest engagement through automation, personalized communication, loyalty points,  | 0.2 | 10 | 0 | **192** |
| İtibar Yönetimi | `ReputationManagement` | Aggregates online reviews, analyzes sentiment with AI, and delivers actionable insights fo | 0.2 | 0 | 20 | **240** |
| Misafir App (Generic) | `GuestMobileApplication(SuperAssistant)` | Guest Generic Mobile Application is a ready to use guest mobile app with standard features | 0.5 | 0 | 100 | **1200** |
| Devre Tatil | `Timeshare` | Eptera Timeshare module simplifies hotel operations with contract management, annual track | 0.8 | 20 | 0 | **528** |
| WhatsApp | `WhatsappIntegration` | Enables personalized WhatsApp communications with template messages and automated workflow | 0.1 | 5 | 0 | **96** |
| Karbon | `Development(CarbonNotr)` | Eptera Carbon Offsetting module calculates the carbon footprint of a guest stay, processes | 0.083333 | 0 | 10 | **120** |

### 2.2 POS

| Модуль | CODE | Описание | ROOM €/мес | BASE €/мес | MIN €/мес | Год (30 ном.) |
|--------|------|----------|------------|------------|-----------|---------------|
| Restoran POS | `POS` | Seamlessly integrates with PMS and inventory, enabling automatic posting to guest folios a | 0.2 | 20 | 0 | **360** |
| Akıllı Dijital Menü | `DigitalMenu` | — | 0.2 | 10 | 10 | **240** |
| SPA | `SPA` | Schedules rooms and staff, tracks sales and commissions, manages payments, and supports bu | 0.2 | 20 | 0 | **360** |

### 2.3 ERP

| Модуль | CODE | Описание | ROOM €/мес | BASE €/мес | MIN €/мес | Год (30 ном.) |
|--------|------|----------|------------|------------|-----------|---------------|
| Muhasebe | `ACC` | A modern corporate accounting system unifies financial operations—general ledger, Accounts | 0.4 | 10 | 0 | **264** |
| e-Fatura/e-Arşiv | `E-InvoiceIntegration` | Eptera lets you manage e-Invoice e-Archive e-Delivery Note and e-Ledger processes in a com | 0.04 | 5 | 0 | **74.4** |
| Stok | `STOCK` | Provides real-time procurement, inventory, cost control, stock levels, and purchase planni | 0.2 | 10 | 0 | **192** |
| Demirbaş | `FixedAsset` | Tracks assets, amortization, barcode labeling, usage history, loss/waste, and vendor-based | 0.1 | 5 | 0 | **96** |
| Üretim/Maliyet | `F&B` | Eptera Production, Recipes & Costing helps hotels and restaurants manage ingredients, semi | 0.2 | 10 | 0 | **192** |
| Satın Alma | `Procurement` | Eptera Procurement Software streamlines the full purchasing cycle from department requests | 0.1 | 10 | 0 | **156** |
| Personel/Bordro | `HR` | Centralizes employee data, documents, approvals, leave tracking, and internal communicatio | 0.2 | 10 | 0 | **216** |
| Kalite (полный пакет) | `QM` | Eptera Quality and Document Management is a web and cloud based system for managing qualit | 0.1 | 0 | 10 | **120** |

### 2.4 Прочее

| Модуль | CODE | Описание | ROOM €/мес | BASE €/мес | MIN €/мес | Год (30 ном.) |
|--------|------|----------|------------|------------|-----------|---------------|
| Premium Sunucu PMS | `PremiumServerforPMS` | — | 0 | 200 | 0 | **2400** |
| Park Otomasyon | `PARK` | Eptera Park Automation is a cloud based ticketing and access control system for theme park | 0.4 | 200 | 0 | **2904** |
| Marina | `MARIN` | Eptera Marina Management System helps marinas manage operations from a single cloud based  | 2 | 0 | 360 | **4320** |
| Eptera Boutique | `Boutique` | Eptera Boutique is a cloud-native PMS for small boutique hotels with up to 50 rooms, inclu | 0.5 | 0 | 25 | **300** |

## 3. Полный прайс-лист (публичный конфигуратор, 105 позиций)

Сортировка по ORDERNO. Цена — **годовая EUR**, 30 номеров, пакет Standart, 1 год.

| # | Название | CODE | €/мес | €/год | MIN | BASE | ROOM | Install € | USEFACTOR |
|---|----------|------|-------|-------|-----|------|------|-----------|-----------|
| 1 | Ön Büro Yönetimi | PMS | 72 | **864** | 30 | 0 | 2.4 |  | true |
| 2 | Kanal Yönetimi & Online Rezervasyon | ChannelManager&BookingEngine | 30 | **360** | 15 | 0 | 1 |  | true |
| 3 | E-Uygulama  | E-InvoiceIntegration | 6.2 | **74.4** | 0 | 5 | 0.04 |  | true |
| 7 | Muhasebe  | ACC | 22 | **264** | 0 | 10 | 0.4 |  | true |
| 8 | Stok  | STOCK | 16 | **192** | 0 | 10 | 0.2 |  | true |
| 9 | Pos  | POS | 30 | **360** | 0 | 20 | 0.2 |  | true |
| 14 | Sanal Pos Entegrasyonu | VirtualPOSIntegration | 20 | **240** | 0 | 20 | 0 |  | false |
| 15 | Yazarkasa Entegrasyonu | CashRegisterIntegration | 6 | **72** | 0 | 6 | 0 | 50 | false |
| 19 | Mobil Kimlik Okur ve Check-in Standart | SmartIDReaderStandard | 20 | **240** | 0 | 10 | 0 |  | false |
| 20 | Mobil Kimlik Okur ve Check-in Pro | SmartIDReaderPro | 40 | **480** | 0 | 20 | 0 |  | false |
| 24 | İnsan Kaynakları  | HR | 18 | **216** | 0 | 10 | 0.2 |  | true |
| 26 | Satın Alma  | Procurement | 13 | **156** | 0 | 10 | 0.1 |  | true |
| 27 | Demirbaş  | FixedAsset | 8 | **96** | 0 | 5 | 0.1 |  | true |
| 28 | Üretim  | F&B | 16 | **192** | 0 | 10 | 0.2 |  | true |
| 31 |  Akıllı Digital Menü  | DigitalMenu | 20 | **240** | 10 | 10 | 0.1 |  | true |
| 32 | Hotspot Hotel | HotspotHotel | 28.75 | **345** | 0 | 25 | 0.125 | 150 | false |
| 34 | Yedekleme PMS | BackupforPMS | 12.5 | **150** | 12.5 | 0 | 0.25 |  | false |
| 35 | Yedekleme ERP | BackupforERP | 12.5 | **150** | 12.5 | 0 | 0.25 |  | false |
| 36 | Premium Sunucu PMS | PremiumServerforPMS | 200 | **2400** | 0 | 200 | 0 |  | false |
| 37 | Premium Sunucu ERP | PremiumServerforERP | 200 | **2400** | 0 | 200 | 0 |  | false |
| 38 | Görev Yönetimi | TaskManagement | 13 | **156** | 0 | 10 | 0.1 |  | true |
| 39 | CRM ve Sadakat | CRM | 16 | **192** | 0 | 10 | 0.2 |  | true |
| 41 | Elektra Manager (Mobil Uygulama) | ElektraManager(MobileApp) | 16.67 | **200** | 0 | 8.33333 | 0 |  | false |
| 42 | Elektra Operator (Mobil Uygulama) | ElektraOperator(MobileApp) | 16.67 | **200** | 0 | 8.33333 | 0 |  | false |
| 45 | Spa ve Klup Üyelik  | SPA | 30 | **360** | 0 | 20 | 0.2 |  | true |
| 46 |  Satış Pazarlama  | SalesMarketing | 13 | **156** | 0 | 10 | 0.1 |  | true |
| 48 | Standart Web Sitesi | PredesignedWebsite | 40 | **480** | 0 | 40 | 0 |  | false |
| 49 | Özel Tasarım Websitesi | CustomDesignWebsite(IncludingSSL) | 40 | **480** | 0 | 40 | 0 | 1500 | false |
| 50 | Çağrı Merkezi | CALL | 26 | **312** | 0 | 20 | 0.2 |  | true |
| 51 | Whatsapp Entegrasyonu | WhatsappIntegration | 8 | **96** | 0 | 5 | 0.1 |  | false |
| 52 | Muhasebe Entegrasyonu | AccountingIntegration | 16 | **192** | 0 | 10 | 0.2 |  | false |
| 53 | iP / Pay Tv Entegrasyonu | iP/PayTvIntegration | 8 | **96** | 0 | 5 | 0.1 |  | false |
| 54 | Kapı Kilit Entegrasyonu | DoorLockIntegration | 13 | **156** | 0 | 10 | 0.1 |  | false |
| 55 | İtibar Yönetimi  | ReputationManagement | 20 | **240** | 20 | 0 | 0.2 |  | true |
| 56 | Dinamik Fiyatlandırma | DynamicPricing | 20 | **240** | 20 | 0 | 0.2 |  | false |
| 57 | Misafir Mobil Uygulama ( Generic) | GuestMobileApplication(SuperAssistant) | 100 | **1200** | 100 | 0 | 0.5 |  | false |
| 58 | Misafir Mobil Uygulama ( Otele Özel) | GuestMobileApplication(HotelSpecific) | 200 | **2400** | 200 | 0 | 1.5 | 5000 | false |
| 59 | İnsan Kaynakları Personel Portalı (Mobil Uygulama) | IKPP | 30 | **360** | 30 | 0 | 0.5 |  | false |
| 59 | QR PDKS Uygulaması | QRPdksAPP | 23.75 | **285** | 0 | 20 | 0.125 |  | false |
| 60 | Denetim Yönetimi (Mobil Uygulama)  | DYY | 20 | **240** | 20 | 0 | 0.4 |  | true |
| 61 | Okul | Okul | 272.5 | **3270** | 0 | 150 | 0.75 | 1000 | false |
| 69 | Park Otomasyonu  | PARK | 242 | **2904** | 0 | 200 | 0.4 |  | true |
| 70 | Stok Mobil Uygulama (Barkodlu) | StockMobileApplication(Barcode) | 22 | **264** | 20 | 0 | 0.1 |  | true |
| 70 | Hotspot Api | HotspotApi | 10 | **120** | 10 | 0 | 0.08333 |  | false |
| 71 | Karbon Nötrleme | Development(CarbonNotr) | 10 | **120** | 10 | 0 | 0.083333 |  | false |
| 71 | Kimlikokur | ID&PassportScanner | 23 | **276** | 0 | 20 | 0.1 |  | false |
| 73 | Kalite ve Doküman Yönetimi Tüm Paket | QM | 60 | **720** | 10 | 0 | 2 |  | false |
| 73 | Restoran Rezervasyon | DigitalMenu | 20 | **240** | 10 | 10 | 0.2 |  | true |
| 73 | Doküman Yönetimi | QM | 15 | **180** | 10 | 0 | 0.5 |  | false |
| 73 | Denetim Yönetimi | QM | 10 | **120** | 10 | 0 | 0.3 |  | false |
| 73 | DOIF Yönetimi | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | İnsan Kaynakları Yönetimi | QM | 10 | **120** | 10 | 0 | 0.2 |  | false |
| 73 | Strateji ve Süreç Yönetimi | QM | 10 | **120** | 10 | 0 | 0.3 |  | false |
| 73 | Eğitim Yönetimi | QM | 10 | **120** | 10 | 0 | 0.2 |  | false |
| 73 | Ölçme ve Değerlendirme Yönetimi | QM | 10 | **120** | 10 | 0 | 0.3 |  | false |
| 73 | Proje ve Risk Yönetimi | QM | 10 | **120** | 10 | 0 | 0.2 |  | false |
| 73 | Tedarikçi Yönetimi | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | Mevzuat Yönetimi | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | Ekipman ve Bakım Yönetimi | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | Performans Değerlendirme | QM | 10 | **120** | 10 | 0 | 0.2 |  | false |
| 73 | Karbon Ayak İzi Hesaplama | QM | 10 | **120** | 10 | 0 | 0.2 |  | false |
| 73 | Su Ayak İzi Hesaplama | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | GSTC Sertifikasyonu | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 73 | Kampanya Yönetimi | QM | 10 | **120** | 10 | 0 | 0.1 |  | false |
| 74 | Yapay Zeka Entegrasyonu | ArtificialIntelligenceIntegration | 12.5 | **150** | 0 | 12.5 | 0 |  | false |
| 80 | Booking Api | BookingAPI | 20 | **240** | 20 | 0 | 0.16667 |  | false |
| 80 | Check In Kiosk | CheckInKiosk | 40 | **480** | 0 | 20 | 0 |  | false |
| 82 | CRM Api | CRMAPI | 20 | **240** | 20 | 0 | 0.16667 |  | false |
| 84 | Demirbaş ( Barkodlu) Mobil Uygulama | FixedAsset(Barcode)MobileApplication | 22 | **264** | 20 | 0 | 0.1 |  | true |
| 85 | Demirbaş ( RFiD ) Mobil Uygulama | Fixtures(RFiD)MobileApplication | 190 | **2280** | 150 | 0 | 1.5 | 1500 | false |
| 89 | Kolay Rez Api | EasyResAPI | 20 | **240** | 20 | 0 | 0.125 |  | false |
| 91 | Tur Operatörü | TOY | 9.9 | **118.8** | 0 | 0 | 0.33 |  | false |
| 93 | Kanal Yöneticisi Entegrasyonu  | ChannelManagerIntegration | 35 | **420** | 0 | 20 | 0.5 |  | false |
| 94 | Sosyal Medya Entegrasyonu | SocialMediaIntegration | 26 | **312** | 0 | 20 | 0.2 |  | false |
| 96 | GMP3 Service (inpos) | GMP3Service | 8 | **96** | 0 | 8 | 0 |  | false |
| 96 | Web Servis  | WebService | 13 | **156** | 0 | 10 | 0.1 |  | false |
| 97 | KTM Api | Ktmapi | 13 | **156** | 0 | 10 | 0.1 |  | false |
| 98 | Kommo Entegrasyonu | CommoIntg | 10 | **120** | 0 | 10 | 0 |  | false |
| 100 | Santral Entegrasyonu | TelephoneSwitchboardIntegration | 13 | **156** | 0 | 10 | 0.1 |  | false |
| 100 | Ev Sahibi  | PropertyOwner | 60 | **720** | 60 | 0 | 0.4 |  | true |
| 102 | Isıtma Soğutma Entegrasyonu  | HeatingandCoolingIntegration | 8 | **96** | 0 | 5 | 0.1 |  | false |
| 103 | IP Santral  | IPSwitchboard | 31 | **372** | 0 | 20 | 0.3 |  | false |
| 104 | POS Sepet Entegrasyonları | FoodCartIntegration | 7.5 | **90** | 0 | 7.5 | 0 |  | false |
| 105 | Devre Tatil  | Timeshare | 44 | **528** | 0 | 20 | 0.8 |  | true |
| 106 | Turnike Entegrasyonu | TurnstileIntegration | 20 | **240** | 0 | 20 | 0 | 100 | false |
| 116 | Acente Sadakat  Modülü+ Booking Portal | AgencyLoyaltyModule+BookingPortal | 291.67 | **3500** | 0 | 291.66667 | 0 |  | false |
| 122 | Veri Aktarımı | DataTransfer | 0 | **0** | 0 | 0 | 0 | 1000 | false |
| 123 | Eğitim Saat Ücreti | 1HourExtraTraining | 0 | **0** | 0 | 0 | 0 | 30 | true |
| 124 | Tek Seferlik Kurulum ve Eğitim Ücreti | Onetimesetupntrain | 0 | **0** | 0 | 0 | 0 | 75 | false |
| 131 | Medikal Kayıt | MedicalRegistration | 30 | **360** | 30 | 0 | 0.5 |  | true |
| 150 | Hotspot Server 4 Port | HSP4 | 0 | **0** | 0 | 0 | 0 | 425 | false |
| 151 | Hotspot Server 6 Port | HSP6 | 0 | **0** | 0 | 0 | 0 | 725 | false |
| 152 | Kimlikokur A6 Tarayıcı | ID&PassportScannerA6Size | 0 | **0** | 0 | 0 | 0 | 460 | false |
| 153 | Kimlik Okur Swipe Cihazı (MRZ) | IDReaderSwipeDevice(MRZ) | 0 | **0** | 0 | 0 | 0 | 700 | false |
| 154 | Mikrotik Router 1 - 100 (HAPac2) | MRH | 0 | **0** | 0 | 0 | 0 | 110 | false |
| 155 | Mikrotik Router 101 - 200   (RB4011) | MRR | 0 | **0** | 0 | 0 | 0 | 250 | false |
| 156 | Mikrotik Router 201 - 500   (RB1100AHx4) | MR1 | 0 | **0** | 0 | 0 | 0 | 420 | false |
| 157 | Mikrotik Router 500+   (CCR2116) | MRC | 0 | **0** | 0 | 0 | 0 | 1090 | false |
| 162 | Online Check in | OnlineCheckin | 14.5 | **174** | 0 | 10 | 0.15 |  | true |
| 207 | Marina Yönetimi | MARIN | 360 | **4320** | 360 | 0 | 2 |  | false |
| 208 | Fuar ve Sempozyum  | ExhibitionandSymposium | 417 | **5004** | 0 | 417 | 0 |  | false |
| 209 | Golf | Golf | 272.5 | **3270** | 0 | 150 | 0.75 | 1000 | false |
|  | Market (Barkod Okuma Dahil) |  | 14.2 | **170.4** |  | 10 | 0.14 |  | true |
|  | Data Barındırma Bedeli |  | 0 | **0** |  |  |  |  | true |
|  | Data Barındırma Bedeli Kurulumu |  | 0 | **0** |  |  |  |  | true |
---

## 4. Функционал ядра PMS (Ön Büro)

По [странице модуля](https://www.elektraweb.com/on-buro):

- **Резервации:** списки, фильтры, группировка, карточка rezervasyon, контроль дубликатов гостей, блокировка номеров
- **Günlük Durum Ekranı:** дашборд — загрузка, выручка, forecast, проживающие, заметки call-центра; доступ с мобильных
- **Housekeeping:** распределение горничных, статусы комнат (чистая/грязная/неисправна), отчёты
- **Folyo:** мульти-валюта, оплаты, posting, счета, печать
- **Ön muhasebe:** касса, дебиторка, чеки/векселя, e-Fatura/e-Arşiv
- **Forecast и аналитика** по любым полям карточки
- **Blokaj / Roomrack:** drag-and-drop, check-in/out с доски, канал-операции
- **Görev yönetimi:** SLA, эскалация, мобильные уведомления
- **Kimlik bildirimi** (KBS — турецкое законодательство)

### Kanal Yönetimi

- 40+ OTA: Booking, Expedia, Airbnb, Agoda, Hotelbeds, Odamax, Ctrip и др.
- Offline туроператоры: TUI, Anex, Paximum, ETS, Pegos, Odeon
- Двусторонняя синхронизация availability/rates/reservations
- Sanal oda tipleri, stop-sale, сравнение offline/online цен
- Собственные «ElektraWeb kanalları» — прямые брони без комиссии OTA

### Elektraweb Lite

Упрощённый PMS: [oda planı](https://www.elektraweb.com/elektraweb-lite) с drag-and-drop rezervasyon, hızlı posting, folyo, e-fatura — **45+ функций** на маркетинговой странице.

---

## 5. Интересные наблюдения для проекта Nafta

1. **Двойной бренд:** международно продаётся как **Eptera** (eptera.com), в Турции — Elektraweb; те же CODE в API.
2. **Channel Manager + Booking Engine** объединены в одну лицензию (ChannelManager&BookingEngine) — отдельные legacy-продукты (ID 171, 172) скрыты.
3. **Mini-пакет** — агрессивный вход: 25% от room-based цены; каналы «включены» в маркетинге.
4. **ERP — отдельный ценовой cluster:** многие модули CATEGORYID=1, цены ниже PMS, но складываются.
5. **Hardware + SaaS:** Mikrotik routers, Kimlikokur scanners, Hotspot servers — продаются как INSTALLATIONFEE (разово).
6. **Compliance Турции:** KBS kimlik, 5651 hotspot logging, e-Fatura kontörleri (Turkcell/Efinans) — сильная локализация.
7. **Медицина / школы / marina / golf** — вертикали с отдельными SKU (MediClinic, Okul, MARIN, Golf).
8. **API-first для экосистемы:** Booking/CRM/ERP/Task/Reservation API — ~0.167 EUR/номер/мес + MIN 20 EUR/мес каждый.
9. **Cloudflare Turnstile** на teklifapp — но **priceapi открыт** (риск для них, плюс для конкурентного анализа).
10. **Talya Bilişim:** 30+ лет, 38 дилеров; клиенты — TBMM, Merkez Bankası, Tüpraş (гос. сегмент).

---

## 6. Рекомендации для клонирования (Nafta)

| Приоритет | Модуль | Обоснование |
|-----------|--------|-------------|
| P0 | PMS (Ön Büro) | Ядро — 2.4 EUR/номер/мес |
| P0 | Channel + Booking | OTA + direct — 1 EUR/номер/мес |
| P1 | POS + Stok | F&B отель |
| P1 | Muhasebe + e-Fatura | Локальная бухгалтерия |
| P2 | CRM, Call Center, Mobile apps | Дифференциация |
| P3 | Hotspot, Kimlik, KBS | Если рынок = Турция |

**Оценка TCO (ориентир):** отель 50 номеров, Standart, PMS+Channel ≈ **2040 EUR/год** (~170 EUR/мес) без ERP/POS.

---

## 7. Ограничения исследования

- Цены из API актуальны на момент скачивания; Elektraweb может менять без публикации.
- Курс EUR/TRY не фиксирован; кампании (1000 TL/oda) — отдельные контракты.
- Скрытые позиции (HIDE_IN_PRICE_LIST) могут продаваться через sales.
- Функционал маркетинговых страниц может опережать/отставать от лицензий в API.

---

## Приложение: технические ссылки

- Прайс-страница: https://www.elektraweb.com/elektraweb-fiyat-listesi/#offerapp
- API пакетов: https://www.elektraweb.com/priceapi/getapi.php?type=packet
- API периодов: https://www.elektraweb.com/priceapi/getapi.php?type=period
- API продуктов: https://www.elektraweb.com/priceapi/getapi.php?type=product
- Документация: https://yardim.elektraweb.com/
- Приложение: https://app.elektraweb.com/
