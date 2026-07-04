import sharp from "sharp";

async function run() {
  const image = sharp("public/umut-emlak-logo-dark.png");
  const metadata = await image.metadata();
  console.log("Metadata:", metadata);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  console.log("Raw info:", info);

  // Collect some sample pixel colors (where alpha is non-zero)
  const colors = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = info.channels === 4 ? data[i + 3] : 255;

    if (a > 100) {
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      colors.set(hex, (colors.get(hex) || 0) + 1);
    }
  }

  // Sort colors by frequency
  const sortedColors = [...colors.entries()].sort((a, b) => b[1] - a[1]);
  console.log("Top 30 colors in the image:");
  console.log(sortedColors.slice(0, 30));
}

run().catch(console.error);
