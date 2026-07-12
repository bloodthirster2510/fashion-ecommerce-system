import { deflateSync } from 'zlib';
import type { VirtualTryOnProvider, VirtualTryOnProviderBinaryOutput } from './virtual-try-on-provider';

type Rgba = readonly [number, number, number, number];

const baseWidth = 768;
const baseHeight = 768;
const width = 1440;
const height = 1920;
const sx = (value: number) => Math.round((value / baseWidth) * width);
const sy = (value: number) => Math.round((value / baseHeight) * height);

const mockPalettes = [
  { background: '#f6fafd', floor: '#dbe8ec', top: '#2f6eea', bottom: '#213448', shoes: '#111827' },
  { background: '#f7f1eb', floor: '#e5d4c4', top: '#ffffff', bottom: '#3c4b5f', shoes: '#6f4b32' },
  { background: '#eef7f2', floor: '#cde8d8', top: '#198754', bottom: '#111827', shoes: '#0f172a' },
  { background: '#f5f3ff', floor: '#ddd6fe', top: '#7c3aed', bottom: '#2f2f46', shoes: '#1f2937' },
] as const;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const parseColor = (hex: string): Rgba => {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
};

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const setPixel = (buffer: Buffer, x: number, y: number, color: Rgba) => {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const offset = (y * width + x) * 4;
  buffer[offset] = color[0];
  buffer[offset + 1] = color[1];
  buffer[offset + 2] = color[2];
  buffer[offset + 3] = color[3];
};

const fillRect = (buffer: Buffer, x: number, y: number, rectWidth: number, rectHeight: number, color: Rgba) => {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + rectWidth));
  const bottom = Math.min(height, Math.ceil(y + rectHeight));

  for (let row = top; row < bottom; row += 1) {
    for (let col = left; col < right; col += 1) {
      setPixel(buffer, col, row, color);
    }
  }
};

const fillEllipse = (
  buffer: Buffer,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: Rgba,
) => {
  const left = Math.floor(centerX - radiusX);
  const right = Math.ceil(centerX + radiusX);
  const top = Math.floor(centerY - radiusY);
  const bottom = Math.ceil(centerY + radiusY);

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) setPixel(buffer, x, y, color);
    }
  }
};

const fillTrapezoid = (
  buffer: Buffer,
  topY: number,
  bottomY: number,
  topWidth: number,
  bottomWidth: number,
  centerX: number,
  color: Rgba,
) => {
  const heightRange = bottomY - topY;
  for (let y = topY; y <= bottomY; y += 1) {
    const progress = (y - topY) / heightRange;
    const rowWidth = Math.round(topWidth + (bottomWidth - topWidth) * progress);
    fillRect(buffer, centerX - rowWidth / 2, y, rowWidth, 1, color);
  }
};

const encodePng = (rgba: Buffer) => {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const createMockResultImage = (index: number): VirtualTryOnProviderBinaryOutput => {
  const palette = mockPalettes[index % mockPalettes.length];
  const background = parseColor(palette.background);
  const floor = parseColor(palette.floor);
  const top = parseColor(palette.top);
  const bottom = parseColor(palette.bottom);
  const shoes = parseColor(palette.shoes);
  const skin = parseColor('#d9a177');
  const hair = parseColor('#1f2937');
  const white = parseColor('#ffffff');
  const shadow = parseColor('#b6c4ce');

  const pixels = Buffer.alloc(width * height * 4);
  fillRect(pixels, 0, 0, width, height, background);
  fillRect(pixels, 0, sy(588), width, sy(180), floor);
  fillEllipse(pixels, sx(384), sy(642), sx(150), sy(28), shadow);

  fillEllipse(pixels, sx(384), sy(164), sx(48), sy(54), skin);
  fillEllipse(pixels, sx(384), sy(126), sx(52), sy(28), hair);
  fillRect(pixels, sx(365), sy(210), sx(38), sy(34), skin);

  fillRect(pixels, sx(262), sy(258), sx(42), sy(176), skin);
  fillRect(pixels, sx(464), sy(258), sx(42), sy(176), skin);
  fillEllipse(pixels, sx(283), sy(446), sx(25), sy(25), skin);
  fillEllipse(pixels, sx(485), sy(446), sx(25), sy(25), skin);

  if (index === 2) {
    fillTrapezoid(pixels, sy(240), sy(540), sx(160), sx(250), sx(384), top);
    fillRect(pixels, sx(324), sy(250), sx(120), sy(62), white);
  } else {
    fillRect(pixels, sx(306), sy(240), sx(156), sy(190), top);
    fillRect(pixels, sx(322), sy(252), sx(124), sy(20), white);
    fillRect(pixels, sx(314), sy(430), sx(66), sy(170), bottom);
    fillRect(pixels, sx(388), sy(430), sx(66), sy(170), bottom);
  }

  fillEllipse(pixels, sx(334), sy(612), sx(48), sy(17), shoes);
  fillEllipse(pixels, sx(436), sy(612), sx(48), sy(17), shoes);
  fillRect(pixels, sx(452), sy(250), sx(14), sy(175), parseColor('#000000'));

  return {
    buffer: encodePng(pixels),
    mimeType: 'image/png',
    fileName: `mock-try-on-${index + 1}.png`,
  };
};

export const createMockVirtualTryOnProvider = (): VirtualTryOnProvider => ({
  async generate(input) {
    const images = mockPalettes.map((_, index) => createMockResultImage(index));

    return {
      images,
      videoUrl: null,
      providerJobId: `mock-${input.jobId}`,
      metadata: {
        mock: true,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        note: 'Mock provider returns four generated sample images for result layout testing.',
      },
    };
  },
});
