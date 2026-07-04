import { createAdminClient } from "../lib/supabase/admin.ts";
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

async function upload() {
  loadDotEnvLocal();

  const supabase = createAdminClient();
  if (!supabase) {
    console.error("Failed to create Supabase admin client");
    process.exit(1);
  }

  const files = [
    {
      localPath: "public/images/consultants/consultant-1.png",
      storagePath: "consultant-1.png",
    },
    {
      localPath: "public/images/consultants/consultant-2.png",
      storagePath: "consultant-2.png",
    },
    {
      localPath: "public/images/consultants/consultant-3.png",
      storagePath: "consultant-3.png",
    },
  ];

  for (const f of files) {
    const filePath = resolve(process.cwd(), f.localPath);
    console.log(`Reading file: ${filePath}...`);
    let fileBuffer: Buffer;
    try {
      fileBuffer = readFileSync(filePath);
    } catch (err) {
      console.error(`Failed to read file ${f.localPath}:`, err);
      continue;
    }

    console.log(`Uploading ${f.storagePath} to bucket 'content-media'...`);
    const { data, error } = await supabase.storage
      .from("content-media")
      .upload(f.storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${f.storagePath}:`, error.message);
    } else {
      console.log(`Successfully uploaded ${f.storagePath}:`, data.path);
    }
  }

  console.log("Upload complete!");
  process.exit(0);
}

upload().catch((err) => {
  console.error("Upload process failed:", err);
  process.exit(1);
});
