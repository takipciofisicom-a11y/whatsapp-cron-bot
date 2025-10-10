import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";
import fs from "fs";

// Ortam değişkenleri
const tasksUrl = process.env.TASKS_URL;
const pushUrl = process.env.PUSH_URL;
const pushKey = process.env.PUSH_KEY;

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
console.log(`Görevler çekiliyor: ${tasksUrl}`);

try {
  // Görevleri admin/get_tasks.php'den çek
  const { data: tasks } = await axios.get(tasksUrl);
  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç görev bulunamadı.");
    console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
    process.exit(0);
  }

  console.log(`📦 ${tasks.length} görev bulundu.`);

  for (const task of tasks) {
    const { channel_url: channelUrl, push_key: channelPushKey } = task;
    console.log(`🔍 Kanal taranıyor: ${channelUrl}`);

    let posts = [];

    try {
      // Puppeteer başlat
      const executablePath = await chromium.executablePath();
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.goto(channelUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 4000));

      // Kanal sayfasından gönderileri al
      posts = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links = anchors
          .map((a) => a.href)
          .filter((href) => href.includes("/post/"));
        return [...new Set(links)];
      });

      await browser.close();

      console.log(`📸 HTML'den bulunan link sayısı: ${posts.length}`);
    } catch (err) {
      console.warn(`⚠️ Puppeteer hatası: ${err.message}`);
    }

    // Eğer tarama başarısızsa simulate_posts.json dosyasına bak
    if (posts.length === 0 && fs.existsSync("./simulate_posts.json")) {
      try {
        const simulateData = JSON.parse(fs.readFileSync("./simulate_posts.json", "utf8"));
        const simulated = simulateData.find(
          (item) => item.channel_url === channelUrl
        );
        if (simulated) {
          posts = simulated.posts || [];
          console.log(`🧪 Simülasyon modunda: ${posts.length} gönderi bulundu.`);
        }
      } catch (e) {
        console.warn("Simülasyon dosyası okunamadı:", e.message);
      }
    }

    if (posts.length === 0) {
      console.log(`⚠️ Hiç gönderi bulunamadı (${channelUrl}).`);
      continue;
    }

    // Push gönderimi yap
    for (const link of posts) {
      try {
        const res = await axios.post(
          pushUrl,
          new URLSearchParams({
            key: channelPushKey || pushKey,
            external_id: link,
            channel: channelUrl,
          })
        );
        console.log(`✅ Push gönderildi: ${link} (${res.status})`);
      } catch (err) {
        console.log(
          `❌ Push hatası (${link}): ${err.response?.status || err.message}`
        );
      }
    }
  }
} catch (err) {
  console.error(`💥 Genel hata: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
