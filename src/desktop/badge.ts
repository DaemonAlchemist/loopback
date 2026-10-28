import { nativeImage, NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const ICON_PATH = path.resolve(process.cwd(), 'assets', 'icons', 'app-icon.jpg');

// 3x5 micro font bitmap table for numbers 0-9 and '+'
const FONT_3X5: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
};

let cachedBaseImage: NativeImage | null = null;

export function getBaseAppIcon(): NativeImage {
  if (cachedBaseImage) return cachedBaseImage;

  if (fs.existsSync(ICON_PATH)) {
    cachedBaseImage = nativeImage.createFromPath(ICON_PATH);
  } else {
    // 32x32 fallback cyan/emerald gradient
    const buf = Buffer.alloc(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) {
      const offset = i * 4;
      buf[offset] = 6; // R
      buf[offset + 1] = 182; // G
      buf[offset + 2] = 212; // B
      buf[offset + 3] = 255; // A
    }
    cachedBaseImage = nativeImage.createFromBitmap(buf, { width: 32, height: 32 });
  }
  return cachedBaseImage;
}

/**
 * Creates a 32x32 tray icon with a dynamic badge counter overlaid on top.
 */
export function createTrayIconWithBadge(count: number): NativeImage {
  const base = getBaseAppIcon().resize({ width: 32, height: 32 });
  if (count <= 0) {
    return base;
  }

  // Get raw RGBA buffer from 32x32 base image
  const rawBitmap = base.toBitmap();
  const width = 32;
  const height = 32;
  const buffer = Buffer.from(rawBitmap);

  // Badge geometry at top-right
  const text = count > 9 ? '9+' : String(count);
  const cx = 23;
  const cy = 8;
  const radius = text.length > 1 ? 8.5 : 7;

  // Draw badge background circle / pill (emerald green with glow border)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const offset = (y * width + x) * 4;

      if (dist <= radius) {
        if (dist >= radius - 1) {
          // Darker outline for contrast
          buffer[offset] = 4; // R
          buffer[offset + 1] = 120; // G
          buffer[offset + 2] = 87; // B
          buffer[offset + 3] = 255; // A
        } else {
          // Vibrant emerald fill (#10b981)
          buffer[offset] = 16; // R
          buffer[offset + 1] = 185; // G
          buffer[offset + 2] = 129; // B
          buffer[offset + 3] = 255; // A
        }
      }
    }
  }

  // Draw digits using 3x5 font
  if (text.length === 1) {
    drawGlyph(buffer, width, text[0], cx - 1, cy - 2);
  } else if (text.length === 2) {
    drawGlyph(buffer, width, text[0], cx - 4, cy - 2);
    drawGlyph(buffer, width, text[1], cx, cy - 2);
  }

  return nativeImage.createFromBitmap(buffer, { width, height });
}

function drawGlyph(buffer: Buffer, imgWidth: number, char: string, startX: number, startY: number) {
  const glyph = FONT_3X5[char];
  if (!glyph) return;

  for (let row = 0; row < 5; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 3; col++) {
      const isPixel = (bits >> (2 - col)) & 1;
      if (isPixel) {
        const px = startX + col;
        const py = startY + row;
        if (px >= 0 && px < imgWidth && py >= 0 && py < imgWidth) {
          const offset = (py * imgWidth + px) * 4;
          // Crisp white text
          buffer[offset] = 255;
          buffer[offset + 1] = 255;
          buffer[offset + 2] = 255;
          buffer[offset + 3] = 255;
        }
      }
    }
  }
}
