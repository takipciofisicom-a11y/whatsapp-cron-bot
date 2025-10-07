import fetch from "node-fetch";
import * as cheerio from "cheerio";

// 🌐 PHP push endpoint (Render Environment'da ayarladığın değişken)
const PUSH_URL = process.env.PUSH_URL || "https://wpkanal.site/push_post.php";

// 🔁 Basit kanal listesi
const CHANNELS = [
  "https://www.whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w"
];

// 🧩 Yardımcı: PHP sunucusuna post ekleme isteği
async function pushToServer(link) {
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: "3424342343423efwefsddwedwerwerwefedsfsdf", // config.php içindeki inbound_api_key
        external_id: link,
        channel: "auto",
        content: "cron_push"
      })
    });
    const text = await res.text();
    console.log(`📨 Push sonucu (${link}):`, text);
  } catch (err) {
    console.error("❌ Push hatası:", err.message);
  }
}

// 🔍 Kanal tarama fonksiyonu
async function checkChannels() {
  for (const url of CHANNELS) {
    console.log("🔍 Kanal taranıyor:", url);
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      const $ = cheerio.load(html);

      const links = [];
      $("a").each((_, el) => {
        const href = $(el).attr("href");
        if (href && href.startsWith("https://whatsapp.com/channel/")) {
          links.push(href);
        }
      });

      if (links.length === 0) {
        console.log("⚠️ Gönderi bulunamadı:", url);
      } else {
        console.log(`🎯 ${links.length} gönderi bulundu.`);
        for (const link of links) {
          await pushToServer(link);
        }
      }
    } catch (e) {
      console.error("🚨 Kanal tarama hatası:", e.message);
    }
  }
}

// 🧪 Test gönderisi (manuel kontrol)
await pushToServer("https://whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w/999");
console.log("📤 Test gönderisi gönderildi, şimdi normal tarama başlıyor...\n");

// ⏰ Asıl cron işlemi
await checkChannels();

console.log("✅ Tarama tamamlandı.");
