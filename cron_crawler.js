import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

const tasksUrl = process.env.TASKS_URL; // get_tasks.php URL'si
const tasksKey = process.env.TASKS_KEY; // api_key (örnek: supersecretkey123)

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);

try {
  // Görevleri API'den al
  const taskRes = await axios.get(`${tasksUrl}?key=${tasksKey}`);
  const tasks = taskRes.data;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç görev bulunamadı.");
    console.log(`=== TÜM GÖREVLER TAMAMLANDI ===`);
    process.exit(0);
  }

  console.log(`🧩 ${tasks.length} görev bulundu.`);

  // Chromium setup
  const executablePath = await chromium.executablePath;
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  for (const task of tasks) {
    const { channel_url, push_key } = task;
    console.log(`🔍 Kanal taranıyor: ${channel_url}`);

    const page = await browser.newPage();

    // Tarayıcıyı gerçek kullanıcı gibi tanıt
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    try {
      await page.goto(channel_url, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise(r => setTimeout(r, 4000));

      // HTML içeriği çek
      const posts = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links = anchors
          .map(a => a.href)
          .filter(h => h.includes("/post/"));
        return [...new Set(links)];
      });

      console.log(`📦 ${posts.length} gönderi bulundu.`);

      if (posts.length > 0) {
        for (const link of posts) {
          try {
            const res = await axios.post(process.env.PUSH_URL, new URLSearchParams({
              key: push_key,
              external_id: link,
              channel: channel_url
            }));
            console.log(`✅ Push gönderildi: ${link} (${res.status})`);
          } catch (err) {
            console.log(`❌ Push hatası (${link}): ${err.response?.status || err.message}`);
          }
        }
      } else {
        console.log(`⚠️ Gönderi bulunamadı: ${channel_url}`);
      }

    } catch (err) {
      console.log(`💥 Hata oluştu: ${err.message}`);
      const html = await page.content();
      console.log("🔎 Sayfa içeriği (ilk 500 karakter):", html.slice(0, 500));
    }

    await page.close();
  }

  await browser.close();
  console.log("✅ === TÜM GÖREVLER TAMAMLANDI ===");
} catch (err) {
  console.error(`💣 Genel hata: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
