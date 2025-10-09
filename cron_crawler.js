import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

const getTasksUrl = "https://wpkanal.site/admin/get_tasks.php?key=supersecretkey123";

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);

try {
  // 🔹 Aktif görevleri sunucudan al
  const { data: tasks } = await axios.get(getTasksUrl);
  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç aktif görev bulunamadı.");
    process.exit(0);
  }

  console.log(`🔍 ${tasks.length} görev bulundu.`);

  // 🧠 Chromium başlat
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  for (const task of tasks) {
    const { channel_url, push_key } = task;
    console.log(`📡 Kanal taranıyor: ${channel_url}`);

    try {
      const page = await browser.newPage();
      await page.goto(channel_url, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 3000));

      const posts = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const links = anchors.map(a => a.href).filter(h => h.includes("/post/"));
        return [...new Set(links)];
      });

      console.log(`📦 ${posts.length} gönderi bulundu.`);

      for (const link of posts) {
        try {
          const res = await axios.post("https://wpkanal.site/push_post.php", new URLSearchParams({
            key: push_key,
            external_id: link,
            channel: channel_url,
          }));
          console.log(`✅ Push gönderildi: ${link} (${res.status})`);
        } catch (err) {
          console.log(`❌ Push hatası: ${link} -> ${err.message}`);
        }
      }

      await page.close();
    } catch (e) {
      console.log(`💥 Kanal tarama hatası: ${channel_url} -> ${e.message}`);
    }
  }

  await browser.close();
  console.log("✅ === TÜM GÖREVLER TAMAMLANDI ===");
} catch (err) {
  console.error(`💥 Genel hata: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
