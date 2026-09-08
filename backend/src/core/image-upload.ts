import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

// Decode before storing: a signature alone cannot validate an image. Re-encoding
// removes metadata and trailing payloads, and bounds decompression memory.
export async function normalizeImage(bytes: Buffer) {
  try {
    return await sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    throw new BadRequestException('This image is invalid or too large. Use an image under 20 megapixels.');
  }
}
