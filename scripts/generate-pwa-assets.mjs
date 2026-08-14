/**
 * Generates PWA assets for Mega Tehnik Elektronik:
 *  - public/logo.webp                    : compressed original logo
 *  - public/logo-mega-tehnik.webp        : horizontal lockup (logo + "Mega Tehnik Elektronik")
 *  - public/pwa/icon-{192,512}.png/webp  : app icons with rounded gradient background
 *  - public/pwa/icon-maskable-512.png    : maskable icon (full-bleed background)
 *  - public/pwa/apple-touch-icon.png     : iOS home screen icon (180x180)
 *
 * Usage: node scripts/generate-pwa-assets.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_LOGO = join(ROOT, 'design-assets', 'Logo Mega Teknik.png');

const BRAND = {
  line1: 'Mega Tehnik',
  line2: 'Elektronik',
  font: 'Arial, Helvetica, sans-serif',
  bgFrom: '#2563eb',
  bgTo: '#38bdf8',
};

const CANVAS = 1024;
const LOGO_H = 340;
const LOGO_W = Math.round((LOGO_H * 2400) / 2990); // keep source aspect ratio
const LOGO_X = 145;
const TEXT_X = LOGO_X + LOGO_W + 55;
const TEXT_W = CANVAS - TEXT_X - 110;

const GRADIENT = `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stop-color="${BRAND.bgFrom}"/>
  <stop offset="100%" stop-color="${BRAND.bgTo}"/>
</linearGradient>`;

const svgDefs = () => `
  <defs>${GRADIENT}
    <clipPath id="round"><rect width="${CANVAS}" height="${CANVAS}" rx="${CANVAS * 0.225}" ry="${CANVAS * 0.225}"/></clipPath>
  </defs>`;

const content = (logoDataUri) => `
  <image href="${logoDataUri}" x="${LOGO_X}" y="${(CANVAS - LOGO_H) / 2}" width="${LOGO_W}" height="${LOGO_H}"/>
  <text x="${TEXT_X}" y="500" font-family="${BRAND.font}" font-weight="700" font-size="92"
        fill="#ffffff" textLength="${TEXT_W}" lengthAdjust="spacingAndGlyphs">${BRAND.line1}</text>
  <text x="${TEXT_X}" y="625" font-family="${BRAND.font}" font-weight="600" font-size="64"
        fill="#ffffff">${BRAND.line2}</text>`;

const makeSvg = (logoDataUri, { rounded }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  ${svgDefs()}
  ${rounded
    ? `<g clip-path="url(#round)"><rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>${content(logoDataUri)}</g>`
    : `<rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>${content(logoDataUri)}`}
</svg>`;

const roundRect = (x, y, w, h, r) => `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}z`;

const lockupSvg = (logoDataUri) => {
  const W = 1800;
  const H = 800;
  const lh = 560;
  const lw = Math.round((lh * 2400) / 2990);
  const lx = 60;
  const ty = lx + lw + 80;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image href="${logoDataUri}" x="${lx}" y="${(H - lh) / 2}" width="${lw}" height="${lh}"/>
  <text x="${ty}" y="${H / 2 - 15}" font-family="${BRAND.font}" font-weight="800" font-size="165" fill="#ffffff">${BRAND.line1}</text>
  <text x="${ty}" y="${H / 2 + 135}" font-family="${BRAND.font}" font-weight="600" font-size="115" fill="#e0edff">${BRAND.line2}</text>
</svg>`;
};

const bbox = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 25) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        opaque++;
      }
    }
  }
  return { minX, minY, maxX, maxY, opaque, width: info.width, height: info.height };
};

const out = async (name, svg, opts = {}) => {
  const buf = await sharp(Buffer.from(svg)).resize(opts.width ?? CANVAS, opts.height ?? CANVAS).toBuffer();
  const dest = join(ROOT, 'public', name);
  const pngDest = dest.endsWith('.png') ? dest : dest.replace(/\.webp$/, '.png');
  await sharp(buf).png({ compressionLevel: 9 }).toFile(pngDest);
  await sharp(buf).webp({ quality: 82, effort: 6 }).toFile(dest.replace(/\.png$/, '.webp'));
  return { png: pngDest, webp: dest.replace(/\.png$/, '.webp'), bbox: await bbox(buf) };
};

const main = async () => {
  await mkdir(join(ROOT, 'public', 'pwa'), { recursive: true });
  const logoBuffer = await readFile(SRC_LOGO);
  const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  // 1. Compressed original logo (webp)
  await sharp(logoBuffer).resize({ height: 700, withoutEnlargement: true }).webp({ quality: 80, effort: 6 }).toFile(join(ROOT, 'public', 'logo.webp'));
  console.log('logo.webp            : OK (compressed original)');

  // 2. Horizontal lockup (transparent background, for in-app branding)
  await sharp(Buffer.from(lockupSvg(logoDataUri))).webp({ quality: 85, effort: 6 }).toFile(join(ROOT, 'public', 'logo-mega-tehnik.webp'));
  console.log('logo-mega-tehnik.webp: OK (lockup logo + teks)');

  // 3. App icons
  const roundSvg = makeSvg(logoDataUri, { rounded: true });
  const squareSvg = makeSvg(logoDataUri, { rounded: false });

  for (const [name, svg, w] of [
    ['pwa/icon-512.png', roundSvg, 512],
    ['pwa/icon-192.png', roundSvg, 192],
  ]) {
    const r = await out(name, svg, { width: w, height: w });
    const b = r.bbox;
    if (b.minX < 0 || b.maxX >= b.width || b.minY < 0 || b.maxY >= b.height) throw new Error(`content out of bounds: ${name}`);
    if (b.opaque < b.width * b.height * 0.15) throw new Error(`suspiciously empty icon: ${name}`);
    console.log(`${name} -> ${w}x${w} : OK (content ${b.minX}-${b.maxX}, ${b.minY}-${b.maxY})`);
  }

  const mask = await out('pwa/icon-maskable-512.png', squareSvg, { width: 512, height: 512 });
  const mb = mask.bbox;
  if (mb.minX < 0 || mb.maxX >= mb.width || mb.minY < 0 || mb.maxY >= mb.height) throw new Error(`content out of bounds: maskable`);
  console.log(`pwa/icon-maskable-512 -> 512x512 : OK (safe zone ${mb.minX}-${mb.maxX})`);

  // 4. iOS apple-touch-icon (square, iOS applies its own mask)
  const apple = await out('pwa/apple-touch-icon.png', squareSvg, { width: 180, height: 180 });
  console.log(`pwa/apple-touch-icon -> 180x180 : OK`);

  console.log('\nAll PWA assets generated successfully.');
};

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});