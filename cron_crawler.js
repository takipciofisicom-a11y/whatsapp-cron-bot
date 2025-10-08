import axios from "axios";
import * as cheerio from "cheerio";

const PUSH_URL = process.env.PUSH_URL || "https://wpkanal.site/push_post.php";
const CHANNELS = [
  "https://www.whatsapp.com/channel/0029VbBP35F0VycEVdmqmN3w"
];

async function scanChannel(url) {
  console.log(`🔍 Kanal taranıyor: ${url}`);
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const posts = []; // ✅ Tanımlama buraya taşındı

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

    // Her gönderiyi PHP'ye pushla
    for (const p of posts) {
      try {
        const pushRes = await axios.post(PUSH_URL, {
          key: "3424342343423efwefsddwedwerwerwefedsfsdf", // config.php ile aynı olmalı
          external_id: p,
          channel: url,
          content: "auto-fetched"
        });
        console.log(`📤 Push sonucu (${p}):`, JSON.stringify(pushRes.data));
      } catch (pushErr) {
        console.log(`❌ Push hatası (${p}):`, pushErr.message);
      }
    }

  } catch (err) {
    console.log(`⚠️ Kanal içeriği alınamadı: ${url}`, err.message);
  }
}

async function main() {
  console.log(`=== CRON BAŞLADI (${new Date().toLocaleString("tr-TR")}) ===`);
  for (const ch of CHANNELS) {
    await scanChannel(ch);
  }
  console.log(`✅ === CRON TAMAMLANDI ===`);
}

// Her 5 dakikada bir otomatik çalışsın
main();
setInterval(main, 5 * 60 * 1000);
