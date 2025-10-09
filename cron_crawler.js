import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

// Ortam değişkenlerini al
const tasksUrl = process.env.TASKS_URL;
const apiKey = process.env.API_KEY;

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);

try {
  // 1️⃣ Görevleri admin panelinden al
  console.log("🔄 Görevler çekiliyor:", tasksUrl);
  const res = await axios.get(`${tasksUrl}?key=${apiKey}`);
  const tasks = res.data;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç görev bulunamadı.");
    console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
    process.exit(0);
  }

  console.log(`✅ ${tasks.length} görev bulundu.`);

  // 2️⃣ Chromium path kontrolü
  const path = await chromium.executablePath();
  if (!path) {
    console.log("⚠️ Chromium path bulunamadı, fallback başlatılıyor...");
  }
  const executablePath = path || "/usr/bin/chromium-browser";

  // 3️⃣ Chromium başlat
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--single-process",
      "--no-zygote"
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  // 4️⃣ Her bir kanalı sırayla tara
  for (const task of tasks) {
    const { channel_url, push_key } = task;
    console.log(`\n🔍 Kanal taranıyor: ${channel_url}`);

    try {
      await page.goto(channel_url, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const posts = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links = anchors
          .map(a => a.href)
          .filter(href => href.includes("/post/"));
        return [...new Set(links)];
      });

      console.log(`📦 ${posts.length} gönderi bulundu.`);

      if (posts.length > 0) {
        for (const link of posts) {
          try {
            const pushUrl = process.env.PUSH_URL;
            const response = await axios.post(pushUrl, new URLSearchParams({
              key: push_key,
              external_id: link,
              channel: channel_url
            }));
            console.log(`✅ Push gönderildi: ${link} -> ${response.status}`);
          } catch (err) {
            console.log(`❌ Push hatası (${link}): ${err.response?.status || err.message}`);
          }
        }
      } else {
        console.log("⚠️ Gönderi bulunamadı.");
      }
    } catch (err) {
      console.error(`💥 Hata oluştu: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`=== TÜM GÖREVLER TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
} catch (err) {
  console.error(`💥 Genel hata: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
