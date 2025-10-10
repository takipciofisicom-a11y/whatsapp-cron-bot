// cron_crawler.js (CommonJS)
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const TASKS_URL = process.env.TASKS_URL; // örn: https://wpkanal.site/admin/get_tasks.php?key=supersecretkey123
const PUSH_URL = process.env.PUSH_URL || 'https://wpkanal.site/push_post.php';
const GLOBAL_PUSH_KEY = process.env.PUSH_KEY || '';
const SIMULATE_FILE = process.env.SIMULATE_FILE || path.join(__dirname, 'simulate_posts.json');
const TIMEOUT = 20000;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function fetchTasks() {
  if (!TASKS_URL) throw new Error('TASKS_URL env değişkeni tanımlı değil');
  log('🔎 Görevler çekiliyor:', TASKS_URL);
  const res = await axios.get(TASKS_URL, { timeout: TIMEOUT });
  return res.data;
}

function extractPostLinksFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const anchors = $('a').map((i, el) => $(el).attr('href')).get().filter(Boolean);
  const abs = anchors.map(href => {
    try {
      // mutlak ise olduğu gibi, değilse base ile tamamla
      if (href.startsWith('http://') || href.startsWith('https://')) return href;
      if (href.startsWith('//')) {
        const u = new URL(baseUrl);
        return u.protocol + href;
      }
      const u = new URL(baseUrl);
      if (href.startsWith('/')) return u.origin + href;
      return u.origin + (href.startsWith('.') ? href.replace(/^\.\//, '/') : '/' + href);
    } catch (e) {
      return href;
    }
  });

  const unique = [...new Set(abs)];
  // WhatsApp kanal post linkleri genelde: /channel/<id>/<postid> veya /channel/<id>/...
  const posts = unique.filter(h => /\/channel\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+/.test(h));
  return posts;
}

async function tryFetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });
    if (res.status === 200 && typeof res.data === 'string') return res.data;
    return null;
  } catch (e) {
    return null;
  }
}

function readSimulatePosts() {
  try {
    if (!fs.existsSync(SIMULATE_FILE)) return [];
    const raw = fs.readFileSync(SIMULATE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    // dosya basit array of links veya array of { channel, link }
    if (Array.isArray(obj)) return obj;
    return [];
  } catch (e) {
    log('⚠️ Simülasyon dosyası okunamadı:', e.message);
    return [];
  }
}

async function pushPost(link, channelUrl, pushKey) {
  try {
    const key = pushKey || GLOBAL_PUSH_KEY || '';
    const params = new URLSearchParams();
    params.append('key', key);
    params.append('external_id', link);
    params.append('channel', channelUrl);

    const res = await axios.post(PUSH_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: TIMEOUT
    });
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    const status = err.response?.status || null;
    const msg = err.message || 'unknown';
    return { ok: false, status, msg, err: err.response?.data || null };
  }
}

(async () => {
  log('=== CRON BAŞLADI ===');
  try {
    const tasks = await fetchTasks();
    if (!Array.isArray(tasks) || tasks.length === 0) {
      log('ℹ️ Görev yok (tasks boş).');
    } else {
      log(`📋 ${tasks.length} görev bulundu.`);
    }

    const simulateAll = readSimulatePosts();

    for (const t of tasks) {
      const channelUrl = t.channel_url || t.channel || t.channelUrl;
      const pushKey = t.push_key || t.pushKey || t.push_key || null;

      if (!channelUrl) {
        log('⚠️ Görevde channel_url yok, atlanıyor:', JSON.stringify(t));
        continue;
      }

      log('🔍 Kanal taranıyor:', channelUrl);
      // 1) HTML çekmeye çalış
      const html = await tryFetchHtml(channelUrl);
      let posts = [];
      if (html) {
        posts = extractPostLinksFromHtml(html, channelUrl);
        log(`📦 HTML’den bulunan link sayısı: ${posts.length}`);
      } else {
        log('⚠️ Kanal içeriği alınamadı (HTML yok veya error).');
      }

      // 2) Eğer hiç gönderi yoksa simulate dosyasında bu kanala özel link var mı kontrol et
      if (posts.length === 0 && simulateAll.length > 0) {
        // simulate dosyası ya string array (linkler) veya object array { channel, link }
        const matches = simulateAll.filter(s => {
          if (typeof s === 'string') return s.includes(channelUrl) || channelUrl.includes(s);
          if (s && s.channel && s.link) return s.channel === channelUrl;
          return false;
        }).map(s => (typeof s === 'string' ? s : s.link));

        if (matches.length > 0) {
          log(`🧪 Simülasyon dosyasından ${matches.length} gönderi alındı.`);
          posts = matches;
        } else {
          // fallback: alttaki tüm simulate gönderileri de gönderilsin istenirse
          // posts = simulateAll.filter(x => typeof x === 'string'); // opsiyonel
          log('ℹ️ Simülasyon dosyasında bu kanala özel gönderi bulunamadı.');
        }
      }

      if (!posts || posts.length === 0) {
        log('⚠️ Gönderi bulunamadı:', channelUrl);
      } else {
        let successCount = 0;
        for (const link of posts) {
          log('🚀 Push gönderiliyor:', link);
          const result = await pushPost(link, channelUrl, pushKey);
          if (result.ok) {
            successCount++;
            log('✅ Push başarılı:', link, 'HTTP', result.status);
          } else {
            log('❌ Push hatası:', link, 'status=', result.status, 'msg=', result.msg);
          }
        }
        log(`🎯 ${successCount}/${posts.length} gönderi pushlandı.`);
      }
    }
  } catch (e) {
    log('💥 Genel hata:', e.message || e);
  } finally {
    log('=== CRON TAMAMLANDI ===');
  }
})();
