import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

const tasksUrl = process.env.TASKS_URL; // Örnek: https://wpkanal.site/admin/get_tasks.php?key=supersecretkey123
const pushUrl = process.env.PUSH_URL;

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true
});
try {
  console.log(`🛰️ Görevler çekiliyor: ${tasksUrl}`);
  const response = await axios.get(tasksUrl);
  const tasks = response.data;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç görev bulunamadı.");
  } else {
    console.log(`📋 ${tasks.length} görev bulundu.`);
  }

  for (const task of tasks) {
    const { channel_url, push_key } = task;
    console.log(`🔍 Kanal taranıyor: ${channel_url}`);

    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
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
    await browser.close();

    if (posts.length === 0) {
      console.log(`⚠️ Hiç gönderi bulunamadı (${channel_url}).`);
    } else {
      for (const link of posts) {
        try {
          const res = await axios.post(pushUrl, new URLSearchParams({
            key: push_key,
            external_id: link,
            channel: channel_url
          }));
          console.log(`✅ Push gönderildi: ${link} -> ${res.status}`);
        } catch (err) {
          console.log(`❌ Push hatası (${link}): ${err.response?.status || err.message}`);
        }
      }
    }
  }

} catch (err) {
  console.error(`💥 Genel hata: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);

