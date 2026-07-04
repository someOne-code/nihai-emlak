import sharp from "sharp";

async function run() {
  const image = sharp("public/umut-emlak-logo-light.png");
  const metadata = await image.metadata();
  console.log("Metadata:", metadata);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  console.log("Raw info:", info);

  // Check some pixel values
  const transparentCount = [];
  const blueCount = [];
  const whiteCount = [];
  const otherCount = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) {
      transparentCount.push({ r, g, b, a });
    } else if (r === 255 && g === 255 && b === 255) {
      whiteCount.push({ r, g, b, a });
    } else if (b > 140 && g > 70) {
      blueCount.push({ r, g, b, a });
    } else {
      otherCount.push({ r, g, b, a });
    }
  }

  console.log(`Transparent pixels: ${transparentCount.length}`);
  console.log(`White pixels: ${whiteCount.length}`);
  console.log(`Blue pixels: ${blueCount.length}`);
  console.log(`Other pixels (semi-transparent, etc): ${otherCount.length}`);
}

run().catch(console.error);
