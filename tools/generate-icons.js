#!/usr/bin/env node
/**
 * Genera los iconos de la app dibujando el velocímetro directamente en un
 * búfer RGBA y codificándolo como PNG con `zlib` (sin dependencias externas).
 *
 *   node tools/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // Cada scanline lleva un byte de filtro; usamos 0 (sin filtro).
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- dibujo

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (c0, c1, t) => [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];

const ARC_STOPS = [
  [0.0, [34, 211, 238]],
  [0.35, [52, 211, 153]],
  [0.55, [163, 230, 53]],
  [0.78, [251, 191, 36]],
  [1.0, [251, 59, 78]],
];

function arcColor(t) {
  for (let i = 0; i < ARC_STOPS.length - 1; i++) {
    const [p0, c0] = ARC_STOPS[i];
    const [p1, c1] = ARC_STOPS[i + 1];
    if (t <= p1) return mixColor(c0, c1, (t - p0) / (p1 - p0));
  }
  return ARC_STOPS[ARC_STOPS.length - 1][1];
}

const START_DEG = 135;
const SWEEP_DEG = 270;
const NEEDLE_RATIO = 0.62;

/** Distancia de un punto al segmento a-b. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function render(size, opaque) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.335;
  const thickness = size * 0.075;
  const aa = size * 0.0022; // ancho de la banda de antialias

  const needleDeg = START_DEG + SWEEP_DEG * NEEDLE_RATIO;
  const needleRad = (needleDeg * Math.PI) / 180;
  const needleLen = radius - thickness * 1.1;
  const nx = cx + Math.cos(needleRad) * needleLen;
  const ny = cy + Math.sin(needleRad) * needleLen;
  // La cola queda dentro del buje para que no asome por detrás.
  const tailLen = size * 0.025;
  const tx = cx - Math.cos(needleRad) * tailLen;
  const ty = cy - Math.sin(needleRad) * tailLen;
  const needleColor = arcColor(NEEDLE_RATIO);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);

      // Fondo: degradado radial suave.
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (opaque) {
        const t = Math.min(1, dist / (size * 0.62));
        r = lerp(13, 5, t);
        g = lerp(17, 7, t);
        b = lerp(24, 11, t);
        a = 255;
      }

      // Ángulo del píxel dentro del barrido del dial.
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let sweepPos = deg - START_DEG;
      while (sweepPos < 0) sweepPos += 360;
      const inSweep = sweepPos <= SWEEP_DEG;

      // Los extremos del arco se redondean midiendo la distancia a los topes.
      // Fuera del barrido, el píxel pertenece al tope más cercano: así el
      // remate inicial conserva el color del arco en vez de quedar apagado.
      let arcDist;
      let capRatio = null;
      if (inSweep) {
        arcDist = Math.abs(dist - radius);
      } else {
        const startRad = (START_DEG * Math.PI) / 180;
        const endRad = ((START_DEG + SWEEP_DEG) * Math.PI) / 180;
        const d1 = Math.hypot(px - (cx + Math.cos(startRad) * radius), py - (cy + Math.sin(startRad) * radius));
        const d2 = Math.hypot(px - (cx + Math.cos(endRad) * radius), py - (cy + Math.sin(endRad) * radius));
        arcDist = Math.min(d1, d2);
        capRatio = d1 <= d2 ? 0 : 1;
      }

      // Canal de fondo del arco (tenue) y arco de color hasta la aguja.
      const arcAlpha = 1 - smoothstep(thickness / 2 - aa, thickness / 2 + aa, arcDist);
      if (arcAlpha > 0) {
        const ratio = capRatio != null ? capRatio : Math.max(0, Math.min(1, sweepPos / SWEEP_DEG));
        const filled = ratio <= NEEDLE_RATIO;
        const col = filled ? arcColor(ratio) : [48, 56, 70];
        const alpha = arcAlpha * (filled ? 1 : 0.55);
        r = lerp(r, col[0], alpha);
        g = lerp(g, col[1], alpha);
        b = lerp(b, col[2], alpha);
        a = Math.max(a, Math.round(255 * alpha));
      }

      // Marcas mayores cada 1/6 del barrido.
      if (inSweep) {
        const tickBand = 1 - smoothstep(size * 0.017, size * 0.019, Math.abs(dist - (radius - thickness * 0.95)));
        if (tickBand > 0) {
          const ticks = 6;
          const nearest = Math.round((sweepPos / SWEEP_DEG) * ticks);
          const tickDeg = (nearest / ticks) * SWEEP_DEG;
          const angDiff = Math.abs(sweepPos - tickDeg);
          const tickAlpha = tickBand * (1 - smoothstep(0.8, 1.6, angDiff));
          if (tickAlpha > 0) {
            r = lerp(r, 138, tickAlpha);
            g = lerp(g, 148, tickAlpha);
            b = lerp(b, 166, tickAlpha);
            a = Math.max(a, Math.round(255 * tickAlpha));
          }
        }
      }

      // Aguja.
      const needleDist = distToSegment(px, py, tx, ty, nx, ny);
      const needleAlpha = 1 - smoothstep(size * 0.011, size * 0.011 + aa * 2, needleDist);
      if (needleAlpha > 0) {
        r = lerp(r, needleColor[0], needleAlpha);
        g = lerp(g, needleColor[1], needleAlpha);
        b = lerp(b, needleColor[2], needleAlpha);
        a = Math.max(a, Math.round(255 * needleAlpha));
      }

      // Buje central.
      const hubAlpha = 1 - smoothstep(size * 0.045, size * 0.045 + aa * 2, dist);
      if (hubAlpha > 0) {
        const ringAlpha = smoothstep(size * 0.033, size * 0.036, dist) * hubAlpha;
        const col = ringAlpha > 0.5 ? needleColor : [11, 15, 22];
        r = lerp(r, col[0], hubAlpha);
        g = lerp(g, col[1], hubAlpha);
        b = lerp(b, col[2], hubAlpha);
        a = Math.max(a, Math.round(255 * hubAlpha));
      }

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(Math.max(0, Math.min(255, r)));
      rgba[i + 1] = Math.round(Math.max(0, Math.min(255, g)));
      rgba[i + 2] = Math.round(Math.max(0, Math.min(255, b)));
      rgba[i + 3] = Math.round(Math.max(0, Math.min(255, a)));
    }
  }
  return encodePng(size, size, rgba);
}

// `assets/images` es la ruta que espera la plantilla estándar de Expo; algunas
// herramientas la asumen aunque app.json apunte a otro sitio.
const outDir = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon.png', 1024, true],
  ['adaptive-icon.png', 1024, true],
  ['splash-icon.png', 512, false],
  ['favicon.png', 64, true],
];

for (const [name, size, opaque] of targets) {
  const png = render(size, opaque);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`${name.padEnd(20)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
