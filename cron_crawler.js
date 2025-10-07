// cron_crawler.js
// Bu dosya Render üzerinde 5 dakikada bir çalışır.
// WhatsApp kanalını tarar, yeni gönderi bulursa wpkanal.site'ye POST eder.

import fetch from "node-fetch";

const CHANNEL_URL = "https://www.whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w";
const PUSH_URL = "https://wpkanal.site/push_post.php";
const PUSH_KEY = "3424342343423efwefsddwedwerwerwefedsfsdf"; // config.php'deki inbound_api_key ile aynı olmalı

async function checkChannel() {
  console.log("🔍 Kanal taranıyor:", CHANNEL_URL);

  try {
    const res = await fetch(CHANNEL_URL);
    const html = await res.text();

    // Kanal sayfasında gönderi linklerini bul
    const regex = /https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9/._-]+/g;
    const matches = [...new Set(html.match(regex))];

    if (!matches.length) {
      console.log("⚠️ Gönderi bulunamadı.");
      return;
    }

    console.log("📦 Bulunan gönderiler:", matches.length);

    for (const postUrl of matches) {
      console.log("➡️ Yeni gönderi kontrol ediliyor:", postUrl);

      // wpkanal.site'ye bildir
      const pushRes = await fetch(PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          key: PUSH_KEY,
          external_id: postUrl,
          channel: CHANNEL_URL,
          content: "Auto-detected from Node.js"
        })
      });

      const text = await pushRes.text();
      console.log("📩 Sunucu yanıtı:", text);
    }

    console.log("✅ Tarama tamamlandı.");

  } catch (err) {
    console.error("❌ Hata:", err.message);
  }
}

await checkChannel();
