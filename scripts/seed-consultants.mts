import { getPayload } from "payload";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    console.warn("Could not find .env.local file");
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

async function seed() {
  loadDotEnvLocal();
  
  const { default: configPromise } = await import("../payload.config.ts");
  const payload = await getPayload({ config: configPromise });

  console.log("Cleaning up existing consultants...");
  const existing = await payload.find({
    collection: "consultants",
    limit: 100,
    overrideAccess: true,
  });

  for (const doc of existing.docs) {
    console.log(`Deleting consultant: ${doc.fullName}`);
    await payload.delete({
      collection: "consultants",
      id: doc.id,
      overrideAccess: true,
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:36521";

  const consultantsToInsert = [
    {
      fullName: "Umut Can Yılmaz",
      slug: "umut-can-yilmaz",
      title: "Kurucu / Gayrimenkul Yatırım Uzmanı",
      photoUrl: `${supabaseUrl}/storage/v1/object/public/content-media/consultant-1.png`,
      shortBio: "Kayseri ve çevre bölgelerde 10 yılı aşkın süredir lüks konut, ticari mülk ve arsa yatırımları konusunda danışmanlık yapmaktadır.",
      phone: "+90 (555) 123 4567",
      email: "umut.can@umutemlak.com",
      whatsappUrl: "https://wa.me/905551234567",
      linkedinUrl: "https://linkedin.com/in/umut-emlak",
      isPublished: true,
      sortOrder: 1,
    },
    {
      fullName: "Ayşe Kaya",
      slug: "ayse-kaya",
      title: "Kiralık Konut ve Ticari Mülk Danışmanı",
      photoUrl: `${supabaseUrl}/storage/v1/object/public/content-media/consultant-2.png`,
      shortBio: "Kayseri Talas ve Melikgazi bölgelerinde kiralık daireler ve ticari dükkan portföy yönetimi konusunda uzmandır.",
      phone: "+90 (555) 987 6543",
      email: "ayse.kaya@umutemlak.com",
      whatsappUrl: "https://wa.me/905559876543",
      linkedinUrl: "https://linkedin.com/in/ayse-kaya",
      isPublished: true,
      sortOrder: 2,
    },
    {
      fullName: "Mehmet Demir",
      slug: "mehmet-demir",
      title: "Arsa ve Proje Geliştirme Danışmanı",
      photoUrl: `${supabaseUrl}/storage/v1/object/public/content-media/consultant-3.png`,
      shortBio: "Kayseri genelinde arsa alım-satım, imar analizi ve kat karşılığı proje geliştirme süreçlerinde kurumsal yatırımcılara rehberlik etmektedir.",
      phone: "+90 (555) 444 3322",
      email: "mehmet.demir@umutemlak.com",
      whatsappUrl: "https://wa.me/905554443322",
      linkedinUrl: "https://linkedin.com/in/mehmet-demir",
      isPublished: true,
      sortOrder: 3,
    }
  ];

  console.log("Inserting consultants...");
  for (const c of consultantsToInsert) {
    const doc = await payload.create({
      collection: "consultants",
      data: c,
      overrideAccess: true,
    });
    console.log(`Created consultant: ${doc.fullName} with ID: ${doc.id}`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
