/**
 * Scrape Elektraweb module pages for catalog generation
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT_DIR = path.join(__dirname, '..', 'doc');
const IMG_DIR = path.join(OUT_DIR, 'screenshots', 'elektraweb');
const CACHE_DIR = path.join(OUT_DIR, '.cache', 'pages');

const WEBSITE_MODULES = [
  { cat: 'Otel / PMS', slug: 'on-buro', code: 'PMS', name: 'Ön Büro Modülü' },
  { cat: 'Otel / PMS', slug: 'kanal-yonetimi', code: 'ChannelManager&BookingEngine', name: 'Kanal Yönetimi' },
  { cat: 'Otel / PMS', slug: 'online-rezervasyon-motoru', code: 'ChannelManager&BookingEngine', name: 'Online Rezervasyon Motoru' },
  { cat: 'Otel / PMS', slug: 'satis-projeleri-ve-banket-yonetimi', code: 'SalesMarketing', name: 'Satış ve Banket Yönetimi' },
  { cat: 'Otel / PMS', slug: 'acente-bonus', code: 'AgencyLoyaltyModule+BookingPortal', name: 'Acente Bonus' },
  { cat: 'Otel / PMS', slug: 'tur-operatoru-entegrasyonu', code: 'TOY', name: 'Tur Operatörü Entegrasyonu' },
  { cat: 'Otel / PMS', slug: 'kimlikokur-kimlik-ve-pasaport-okuma', code: 'ID&PassportScanner', name: 'Kimlikokur' },
  { cat: 'Otel / PMS', slug: 'hotspot-internet-guvenlik-ve-loglama-sistemi', code: 'HotspotHotel', name: 'Hotspot ve Loglama' },
  { cat: 'Otel / PMS', slug: 'cagri-merkezi-programi', code: 'CALL', name: 'Çağrı Merkezi' },
  { cat: 'Otel / PMS', slug: 'mobil-kimlik-okur-ve-check-in', code: 'SmartIDReaderStandard', name: 'Mobil Kimlik Okur' },
  { cat: 'Otel / PMS', slug: 'check-in-kiosk', code: 'CheckInKiosk', name: 'Check-in Kiosk' },
  { cat: 'Otel / PMS', slug: 'fiyat-yonetimi', code: 'DynamicPricing', name: 'Dinamik Fiyatlandırma' },
  { cat: 'Otel / PMS', slug: 'elektraweb-sadakat-ve-crm-yonetimi', code: 'CRM', name: 'Sadakat ve CRM' },
  { cat: 'Otel / PMS', slug: 'akilli-sohbet', code: 'ArtificialIntelligenceIntegration', name: 'Akıllı Sohbet' },
  { cat: 'Otel / PMS', slug: 'itibar-yonetimi', code: 'ReputationManagement', name: 'İtibar Yönetimi' },
  { cat: 'Otel / PMS', slug: 'web-sitesi-tasarimi', code: 'PredesignedWebsite', name: 'Web Sitesi Tasarımı' },
  { cat: 'Otel / PMS', slug: 'misafir-uygulamasi', code: 'GuestMobileApplication(SuperAssistant)', name: 'Misafir Uygulaması' },
  { cat: 'Otel / PMS', slug: 'devremulk-ve-devre-tatil-yonetimi', code: 'Timeshare', name: 'Devremülk ve Devre Tatil' },
  { cat: 'Otel / PMS', slug: 'whatsapp-api', code: 'WhatsappIntegration', name: 'WhatsApp API' },
  { cat: 'Otel / PMS', slug: 'karbon-ayak-izi-sifirlama-modulu', code: 'Development(CarbonNotr)', name: 'Karbon Dengeleme' },
  { cat: 'POS', slug: 'restoran-pos-yonetim-programi', code: 'POS', name: 'Restoran POS' },
  { cat: 'POS', slug: 'restoran-online-rezervasyon-sistemi', code: 'DigitalMenu', name: 'Restoran Online Rezervasyon' },
  { cat: 'POS', slug: 'akilli-dijital-menu', code: 'DigitalMenu', name: 'Akıllı Dijital Menü' },
  { cat: 'POS', slug: 'spa-ve-spor-salonu-yonetimi', code: 'SPA', name: 'SPA ve Spor Salonu' },
  { cat: 'ERP', slug: 'muhasebe-yonetimi', code: 'ACC', name: 'Muhasebe Yönetimi' },
  { cat: 'ERP', slug: 'e-fatura-e-arsiv-e-irsaliye', code: 'E-InvoiceIntegration', name: 'e-Fatura / e-Arşiv / e-İrsaliye' },
  { cat: 'ERP', slug: 'stok-takip-programi', code: 'STOCK', name: 'Stok Takip' },
  { cat: 'ERP', slug: 'demirbas-ve-amortisman-yonetimi', code: 'FixedAsset', name: 'Demirbaş Yönetimi' },
  { cat: 'ERP', slug: 'uretim-recetelendirme-ve-maliyet-analizi', code: 'F&B', name: 'Üretim ve Maliyet' },
  { cat: 'ERP', slug: 'satin-alma-yonetimi', code: 'Procurement', name: 'Satın Alma' },
  { cat: 'ERP', slug: 'banka-entegrasyonlari', code: 'AccountingIntegration', name: 'Banka Entegrasyonları' },
  { cat: 'ERP', slug: 'personel-ve-bordro-yonetimi', code: 'HR', name: 'Personel ve Bordro' },
  { cat: 'ERP', slug: 'sirketim-ik-mobil-uygulama', code: 'IKPP', name: 'Şirketim İK Mobil' },
  { cat: 'ERP', slug: 'kalite-ve-dokuman-yonetim-sistemi', code: 'QM', name: 'Kalite ve Doküman Yönetimi' },
  { cat: 'Diğer', slug: 'elektraweb-lite', code: 'MINI', name: 'Elektraweb Lite' },
  { cat: 'Diğer', slug: 'elektraweb-mini', code: 'MINI', name: 'Elektraweb MINI' },
  { cat: 'Diğer', slug: 'yapay-zeka-destekli-otel-yonetimi', code: 'ArtificialIntelligenceIntegration', name: 'Yapay Zeka Destekli Otel' },
  { cat: 'Diğer', slug: 'otel-satis-portali', code: 'PORTAL', name: 'Otel Satış Portalı' },
  { cat: 'Diğer', slug: 'park-otomasyon-cozumleri', code: 'PARK', name: 'Park Otomasyon' },
  { cat: 'Diğer', slug: 'sistem-entegrasyonlari', code: 'WebService', name: 'Sistem Entegrasyonları' },
  { cat: 'Diğer', slug: 'fuar-ve-sempozyum-dijital-kayit-sistemi', code: 'ExhibitionandSymposium', name: 'Fuar Kongre Kayıt' },
  { cat: 'Diğer', slug: 'yurt-yonetim-programi', code: 'Okul', name: 'Yurt Yönetim Programı' },
  { cat: 'Diğer', slug: 'marina-yonetim-sistemi', code: 'MARIN', name: 'Marina Yönetim' },
  { cat: 'Diğer', slug: 'tedarik-portali', code: null, name: 'Tedarik Portalı' },
  { cat: 'Diğer', slug: 'premium-sunucu-hizmeti', code: 'PremiumServerforPMS', name: 'Premium Sunucu' },
  { cat: 'Diğer', slug: 'google-yedekleme', code: 'BackupforPMS', name: 'Google Yedekleme' },
  { cat: 'Diğer', slug: 'viofun', code: null, name: 'Viofun' },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 25000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseModulePage(html, slug) {
  const sections = [];
  const images = [];

  // h2/h3 blocks with following content
  const h2re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = h2re.exec(html)) !== null) {
    const title = stripHtml(m[1]).slice(0, 120);
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 3000);
    const bullets = [];
    const lire = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li;
    let count = 0;
    while ((li = lire.exec(after)) !== null && count < 15) {
      const t = stripHtml(li[1]);
      if (t.length > 8 && t.length < 400) { bullets.push(t); count++; }
    }
    const pmatch = after.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const para = pmatch ? stripHtml(pmatch[1]).slice(0, 500) : '';
    if (title && (bullets.length || para.length > 30)) {
      sections.push({ title, para, bullets });
    }
  }

  // images from uploads
  const imgre = /https:\/\/www\.elektraweb\.com\/wp-content\/uploads\/[^"'\s)]+\.(?:jpg|jpeg|png|webp)/gi;
  let im;
  const seen = new Set();
  while ((im = imgre.exec(html)) !== null) {
    const u = im[0].split('?')[0];
    if (!seen.has(u) && !u.includes('logo') && !u.includes('weblogo')) {
      seen.add(u);
      images.push(u);
    }
  }

  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const pageTitle = h1m ? stripHtml(h1m[1]) : slug;

  return { pageTitle, sections: sections.slice(0, 12), images: images.slice(0, 6) };
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error('status ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });

  const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'doc', 'data', 'price_product.json'), 'utf8')).ResultSets[0];
  const byCode = {};
  products.forEach(p => { if (p.CODE) byCode[p.CODE] = p; });

  const results = [];
  const seenSlug = new Set();

  for (const mod of WEBSITE_MODULES) {
    if (seenSlug.has(mod.slug)) continue;
    seenSlug.add(mod.slug);

    const url = `https://www.elektraweb.com/${mod.slug}/`;
    const cacheFile = path.join(CACHE_DIR, mod.slug + '.html');
    let html;
    try {
      if (fs.existsSync(cacheFile)) {
        html = fs.readFileSync(cacheFile, 'utf8');
      } else {
        console.log('Fetch', url);
        const res = await fetchUrl(url);
        html = res.body;
        fs.writeFileSync(cacheFile, html);
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      console.warn('FAIL', mod.slug, e.message);
      results.push({ ...mod, error: e.message, sections: [], images: [], localImages: [] });
      continue;
    }

    const parsed = parseModulePage(html, mod.slug);
    const api = mod.code ? byCode[mod.code] : null;
    const localImages = [];

    for (let i = 0; i < Math.min(parsed.images.length, 3); i++) {
      const imgUrl = parsed.images[i];
      const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
      const fname = `${mod.slug}-${i + 1}${ext}`;
      const dest = path.join(IMG_DIR, fname);
      try {
        if (!fs.existsSync(dest)) {
          await downloadFile(imgUrl, dest);
          console.log('  img', fname);
        }
        localImages.push(`screenshots/elektraweb/${fname}`);
      } catch (e) {
        localImages.push(imgUrl); // fallback URL
      }
    }

    results.push({
      ...mod,
      url,
      api,
      pageTitle: parsed.pageTitle,
      sections: parsed.sections,
      imageUrls: parsed.images,
      localImages,
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'modules-scrape-data.json'), JSON.stringify(results, null, 2));
  console.log('Done', results.length, 'modules');
}

main().catch(e => { console.error(e); process.exit(1); });
