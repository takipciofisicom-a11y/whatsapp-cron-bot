import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import axios from "axios";

// ENV değişkenleri
const tasksUrl = process.env.TASKS_URL; // Örn: https://wpkanal.site/admin/get_tasks.php
const apiKey = process.env.API_KEY;     // Örn: supersecretkey123
const pushUrl = process.env.PUSH_URL;   // Örn: https://wpkanal.site/admin/push_post.php

console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);

try {
  // 🧩 Admin panelden aktif görevleri çek
  const taskResponse = await axios.get(`${tasksUrl}?key=${apiKey}`);
  const tasks = taskResponse.data;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log("⚠️ Hiç aktif görev bulunamadı, işlem sonlandırıldı.");
    process.exit(0);
  }

  console.log(`📋 ${tasks.length} aktif kanal bulundu.`);

  // 💻 Chromium başlat
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  // 🔁 Her kanalı sırayla tara
  for (const task of tasks) {
    const channelUrl = task.channel_url;
    const pushKey = task.push_key;

    console.log(`\n🔍 Kanal taranıyor: ${channelUrl}`);

    const page = await browser.newPage();
    await page.goto(channelUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Gönderileri bul
    const posts = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const links = anchors
        .map(a => a.href)
        .filter(href => href.includes("/post/"));
      return [...new Set(links)];
    });

    console.log(`📦 ${posts.length} gönderi bulundu.`);

    // 🔁 Her gönderiyi admin paneline gönder
    for (const link of posts) {
      try {
        const res = await axios.post(pushUrl, new URLSearchParams({
          key: pushKey,
          external_id: link,
          channel: channelUrl
        }));
        console.log(`✅ Push gönderildi (${res.status}): ${link}`);
      } catch (err) {
        console.log(`❌ Push hatası (${link}): ${err.response?.status || err.message}`);
      }
    }

    await page.close();
    console.log(`🟢 ${channelUrl} taraması tamamlandı.`);
  }

  await browser.close();
  console.log(`✅ Tüm kanallar başarıyla tarandı.`);
} catch (err) {
  console.error(`💥 Hata oluştu: ${err.message}`);
}

console.log(`=== CRON TAMAMLANDI (${new Date().toLocaleString("tr-TR")}) ===`);
