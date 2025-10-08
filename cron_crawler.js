import puppeteer from "puppeteer";
import axios from "axios";

const channelUrl = process.env.CHANNEL_URL;
const pushUrl = process.env.PUSH_URL;
const pushKey = process.env.PUSH_KEY;

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
console.log(`🔍 Kanal taranıyor: ${channelUrl}`);

try {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(channelUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Sayfa içeriği tam yüklensin
  await page.waitForTimeout(5000);

  // Gönderi linklerini al
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
