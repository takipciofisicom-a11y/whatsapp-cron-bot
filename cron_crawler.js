import fetch from "node-fetch";
import * as cheerio from "cheerio";
import axios from "axios";

const PUSH_URL = process.env.PUSH_URL;

// Tarayacağın kanalları buraya ekle:
const CHANNELS = [
  "https://www.whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w"
];

async function crawlChannel(url) {
  console.log(`\n🔍 Kanal taranıyor: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    $("a[href*='/channel/']").each((_, el) => {
  const link = $(el).attr("href");
  if (link && link.startsWith("/channel/")) {
    posts.push(`https://www.whatsapp.com${link}`);
  }
});


    if (posts.length === 0) {
      console.log(`⚠️ Gönderi bulunamadı: ${url}`);
      return;
    }

    console.log(`🟢 ${posts.length} gönderi bulundu.`);

    for (const post of posts) {
      const fullUrl = post.startsWith("http") ? post : `https://www.whatsapp.com${post}`;
      console.log(`📤 Push gönderiliyor: ${fullUrl}`);

      try {
        const res = await axios.post(PUSH_URL, {
          external_id: fullUrl,
          key: "3424342343423efwefsddwedwerwerwefedsfsdf"
        });
        console.log(`✅ Push sonucu (${fullUrl}): ${JSON.stringify(res.data)}`);
      } catch (err) {
        console.error(`❌ Push hatası (${fullUrl}): ${err.message}`);
      }
    }

  } catch (err) {
    console.error(`❌ Kanal alınamadı (${url}): ${err.message}`);
  }
}

async function main() {
  console.log(`\n=== 🔄 CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
  for (const channel of CHANNELS) {
    await crawlChannel(channel);
  }
  console.log(`=== ✅ CRON TAMAMLANDI ===\n`);
}

main();

// 5 dakikada bir otomatik çalışsın
setInterval(() => {
  console.log("⏱️ 5 dakika geçti — yeni tarama başlatılıyor...");
  main();
}, 5 * 60 * 1000);

