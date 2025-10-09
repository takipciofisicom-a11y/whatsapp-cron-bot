import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

const tasksUrl = process.env.TASKS_URL;
const apiKey = process.env.API_KEY;
const pushUrl = process.env.PUSH_URL;
const pushKey = process.env.PUSH_KEY;

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
console.log(`🔍 Kanal taranıyor: ${channelUrl}`);

try {
  // Admin panelden aktif görevleri çek
const taskResponse = await axios.get(`${tasksUrl}?key=${apiKey}`);
const tasks = taskResponse.data;

for (const task of tasks) {
  const channelUrl = task.channel_url;
  const pushKey = task.push_key;

  console.log(`🔍 Kanal taranıyor: ${channelUrl}`);

  // ... burada senin mevcut tarama kodun devreye girecek
}
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.goto(channelUrl, { waitUntil: "networkidle2", timeout: 60000 });
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
    console.log(`⚠️ Hiç gönderi bulunamadı.`);
  } else {
    for (const link of posts) {
      try {
        const res = await axios.post(pushUrl, new URLSearchParams({
          key: pushKey,
          external_id: link,
          channel: channelUrl
        }));
        console.log(`✅ Push gönderildi: ${link} -> ${res.status}`);
      } catch (err) {
        console.log(`❌ Push hatası (${link}): ${err.response?.status || err.message}`);
      }
    }
  }
} catch (err) {
  console.error(`💥 Hata oluştu: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);


