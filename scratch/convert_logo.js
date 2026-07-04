import sharp from "sharp";

async function run() {
  const inputPath = "public/umut-emlak-logo-dark.png";
  const outputPath = "public/umut-emlak-logo-light.png";

  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // should be 3

  // Create a new buffer with 4 channels (RGBA)
  const outputData = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    // Calculate distance from white (background)
    // Using a simple distance formula
    const distToWhite = Math.sqrt(
      Math.pow(255 - r, 2) + Math.pow(255 - g, 2) + Math.pow(255 - b, 2)
    );

    let outR = r;
    let outG = g;
    let outB = b;
    let outA = 255;

    // Threshold for background transparency
    if (distToWhite < 15) {
      // Fully transparent background
      outR = 0;
      outG = 0;
      outB = 0;
      outA = 0;
    } else {
      // Determine if the pixel is dark navy or blue
      // Navy pixels are dark: R, G, B are all low.
      // Blue pixels have a high B component.
      // Let's use blue component threshold:
      // If b is high (e.g. b > 150) and g is also medium (g > 80), it's the blue part.
      // If b is low (b < 120), it's the dark navy part.
      
      const isBlue = b > 140 && g > 70;

      if (!isBlue) {
        // This is part of the navy text ("UMUT") or navy arrow.
        // We want this to be white in dark mode.
        outR = 255;
        outG = 255;
        outB = 255;
        
        // Anti-aliasing transition: if it's close to white, make it semi-transparent
        if (distToWhite < 80) {
          outA = Math.round((distToWhite / 80) * 255);
        } else {
          outA = 255;
        }
      } else {
        // This is part of the blue text ("EMLAK") or blue house outline.
        // We keep the original blue color, but handle anti-aliasing.
        outR = r;
        outG = g;
        outB = b;
        
        if (distToWhite < 80) {
          outA = Math.round((distToWhite / 80) * 255);
        } else {
          outA = 255;
        }
      }
    }

    outputData[i * 4] = outR;
    outputData[i * 4 + 1] = outG;
    outputData[i * 4 + 2] = outB;
    outputData[i * 4 + 3] = outA;
  }

  // Save the new image as PNG with transparent background
  await sharp(outputData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  console.log(`Saved transparent dark-mode logo to ${outputPath}`);
}

run().catch(console.error);
