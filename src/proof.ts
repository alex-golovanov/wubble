import sharp from "sharp";
import { readFileSync } from "node:fs";

/**
 * Composite a transparent SVG overlay over an art image → PNG buffer.
 */
export async function compositeProof(
  svg: string,
  artPath: string,
): Promise<Buffer> {
  const art = sharp(artPath);
  const meta = await art.metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) {
    throw new Error("Art image has no dimensions");
  }

  const overlay = await sharp(Buffer.from(svg, "utf8"))
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();

  return art
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export function readArtBytes(artPath: string): Buffer {
  return readFileSync(artPath);
}
