import fetch from "node-fetch";
import cheerio from "cheerio";
import axios from "axios";

const PUSH_URL = process.env.PUSH_URL;
const CHANNELS = [
  "https://www.whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w", // kanal linkin
];

async function crawlChannel(url) {
  console.log(`🔍 Kanal taranıyor: ${url}`);
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Gönderileri tespit et
    const posts = [];
    $("a[href*='/channel/']").each((_, el) => {
      const link = $(el).attr("href");
      if (link && link.includes("/channel/")) {
        posts.push(link);
      }
    });

    if (posts.length === 0) {
      console.log(`⚠️ Gönderi bulunamadı: ${url}`);
      return;
    }

    console.log(`🟢 ${posts.length} gönderi bulundu.`);

    // Her gönderiyi backend’e gönder
    for (const post of posts) {
      const fullUrl = post.startsWith("http") ? post : `https://www.whatsapp.com${post}`;
      console.log(`📤 Push gönderiliyor: ${fullUrl}`);
      try {
        const res = await axios.post(PUSH_URL, {
          external_id: fullUrl,
          key: "3424342343423efwefsddwedwerwerwefedsfsdf"
        });
        console.log(`✅ Push sonucu: ${fullUrl} → ${JSON.stringify(res.data)}`);
      } catch (err) {
        console.error(`❌ Push hatası: ${fullUrl} → ${err.message}`);
      }
    }

  } catch (err) {
    console.error(`❌ Kanal alınamadı (${url}):`, err.message);
  }
}

async function main() {
  console.log("=== 🔄 CRON BAŞLADI ===");
  for (const channel of CHANNELS) {
    await crawlChannel(channel);
  }
  console.log("=== ✅ CRON TAMAMLANDI ===");
}

// İlk çalıştırma
main();

// Her 5 dakikada bir tekrar et
setInterval(() => {
  console.log("⏱️ 5 dakikalık cron tetiklendi, tekrar tarama başlatılıyor...");
  main();
}, 5 * 60 * 1000);
