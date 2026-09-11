/**
 * Mega Tehnik Elektronik - iOS Brand Asset Generator
 * Generates the iOS AppIcon and 2732x2732 launch Splash image,
 * matching the Android/PWA splash design from generate-brand-assets.mjs.
 *
 * Run: node scripts/generate-ios-assets.mjs
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IOS_ASSETS = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets');
const MASCOT_SOURCE = join(ROOT, 'design-assets', 'Logo Mega Teknik.png');
const MASTER_ICON = join(ROOT, 'design-assets', 'app-icon-1024.png');

// Square launch splash (Apple recommends 2732x2732 for iPad Pro 12.9")
const SPLASH_SIZE = 2732;

// Same circuit background as the Android splash generator
const circuitBackgroundSvg = (w, h) => `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="techGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#1565C0" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="#0D47A1" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#060a17" stop-opacity="0.95"/>
    </radialGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a1224"/>
      <stop offset="50%" stop-color="#0b1736"/>
      <stop offset="100%" stop-color="#050813"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bgGrad)"/>
  <rect width="${w}" height="${h}" fill="url(#techGlow)"/>

  <g stroke="#2196F3" stroke-opacity="0.12" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 0 ${h * 0.15} H ${w * 0.25} L ${w * 0.35} ${h * 0.22} H ${w * 0.42} V ${h * 0.3}"/>
    <circle cx="${w * 0.42}" cy="${h * 0.3}" r="8" fill="#2196F3" fill-opacity="0.25"/>
    <path d="M ${w * 0.1} 0 V ${h * 0.08} L ${w * 0.18} ${h * 0.14} V ${h * 0.25}"/>
    <circle cx="${w * 0.18}" cy="${h * 0.25}" r="7" fill="#2196F3" fill-opacity="0.25"/>

    <path d="M ${w} ${h * 0.18} H ${w * 0.75} L ${w * 0.65} ${h * 0.25} H ${w * 0.58} V ${h * 0.32}"/>
    <circle cx="${w * 0.58}" cy="${h * 0.32}" r="8" fill="#2196F3" fill-opacity="0.25"/>
    <path d="M ${w * 0.88} 0 V ${h * 0.09} L ${w * 0.8} ${h * 0.15} V ${h * 0.28}"/>
    <circle cx="${w * 0.8}" cy="${h * 0.28}" r="7" fill="#2196F3" fill-opacity="0.25"/>

    <path d="M 0 ${h * 0.45} H ${w * 0.18} L ${w * 0.24} ${h * 0.5} H ${w * 0.3}"/>
    <circle cx="${w * 0.3}" cy="${h * 0.5}" r="7" fill="#2196F3" fill-opacity="0.2"/>
    <path d="M ${w} ${h * 0.48} H ${w * 0.82} L ${w * 0.76} ${h * 0.53} H ${w * 0.7}"/>
    <circle cx="${w * 0.7}" cy="${h * 0.53}" r="7" fill="#2196F3" fill-opacity="0.2"/>

    <path d="M 0 ${h * 0.78} H ${w * 0.22} L ${w * 0.3} ${h * 0.72} H ${w * 0.38}"/>
    <circle cx="${w * 0.38}" cy="${h * 0.72}" r="7" fill="#2196F3" fill-opacity="0.2"/>
    <path d="M ${w} ${h * 0.8} H ${w * 0.78} L ${w * 0.68} ${h * 0.73} H ${w * 0.6}"/>
    <circle cx="${w * 0.6}" cy="${h * 0.73}" r="7" fill="#2196F3" fill-opacity="0.2"/>
  </g>
</svg>
`;

async function generateSplash() {
  const W = SPLASH_SIZE;
  const H = SPLASH_SIZE;
  // Scale typography/progress bar relative to the 1080-wide portrait design
  const s = W / 1080;

  const mascotBuffer = await sharp(MASCOT_SOURCE).toBuffer();

  const mascotTargetH = Math.round(H * 0.3);
  const mascotTargetW = Math.round((mascotTargetH * 2400) / 2990);
  const mascotResized = await sharp(mascotBuffer)
    .resize(mascotTargetW, mascotTargetH, { fit: 'contain' })
    .png()
    .toBuffer();
  const mascotTop = Math.round(H * 0.22);
  const mascotLeft = Math.round((W - mascotTargetW) / 2);

  const textTop = mascotTop + mascotTargetH + Math.round(24 * s);
  const titleSize = Math.round(70 * s);
  const subtitleSize = Math.round(titleSize * 0.55);
  const sloganSize = Math.round(titleSize * 0.45);
  const barWidth = Math.min(Math.round(W * 0.65), 960);
  const barLeft = Math.round((W - barWidth) / 2);
  const barTop = Math.round(H * 0.84);
  const barHeight = Math.round(8 * s);

  const overlaySvg = Buffer.from(`
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0D47A1"/>
        <stop offset="50%" stop-color="#2196F3"/>
        <stop offset="100%" stop-color="#90CAF9"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <text x="${W / 2}" y="${textTop + titleSize}"
          font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${titleSize}"
          fill="#FFFFFF" text-anchor="middle" letter-spacing="${Math.round(2 * s)}">MEGA TEHNIK</text>

    <line x1="${W / 2 - 304}" y1="${textTop + titleSize + 78}" x2="${W / 2 - 177}" y2="${textTop + titleSize + 78}" stroke="#2196F3" stroke-width="6" stroke-linecap="round"/>
    <text x="${W / 2}" y="${textTop + titleSize + 100}"
          font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${subtitleSize}"
          fill="#2196F3" text-anchor="middle" letter-spacing="${Math.round(3 * s)}">ELEKTRONIK</text>
    <line x1="${W / 2 + 177}" y1="${textTop + titleSize + 78}" x2="${W / 2 + 304}" y2="${textTop + titleSize + 78}" stroke="#2196F3" stroke-width="6" stroke-linecap="round"/>

    <text x="${W / 2}" y="${textTop + titleSize + 174}"
          font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="${sloganSize}"
          fill="#90CAF9" text-anchor="middle" letter-spacing="${Math.round(0.5 * s)}">Solusi Elektronik, Terpercaya!</text>

    <rect x="${barLeft}" y="${barTop}" width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="#0f172a" stroke="#1e293b" stroke-width="3"/>
    <rect x="${barLeft}" y="${barTop}" width="${Math.round(barWidth * 0.72)}" height="${barHeight}" rx="${barHeight / 2}" fill="url(#barGrad)" filter="url(#glow)"/>

    <text x="${W / 2}" y="${barTop + 61}"
          font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="30"
          fill="#94a3b8" text-anchor="middle" letter-spacing="${Math.round(1 * s)}">Memuat...</text>
  </svg>
  `);

  const bgBuf = await sharp(Buffer.from(circuitBackgroundSvg(W, H))).png().toBuffer();

  await sharp(bgBuf)
    .composite([
      { input: mascotResized, top: mascotTop, left: mascotLeft },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(IOS_ASSETS, 'Splash.imageset', 'splash-2732x2732.png'));

  console.log(`✓ iOS Splash (${W}x${H}) generated.`);
}

async function generateAppIcon() {
  const iconDir = join(IOS_ASSETS, 'AppIcon.appiconset');
  // Single 1024x1024 icon (AppIcon-512@2x), filename must match Contents.json
  await sharp(MASTER_ICON)
    .resize(1024, 1024, { fit: 'fill' })
    .png()
    .toFile(join(iconDir, 'AppIcon-512@2x.png'));
  console.log('✓ iOS AppIcon (1024x1024) generated.');
}

async function main() {
  await mkdir(join(IOS_ASSETS, 'Splash.imageset'), { recursive: true });
  await mkdir(join(IOS_ASSETS, 'AppIcon.appiconset'), { recursive: true });

  await generateSplash();
  await generateAppIcon();

  await writeFile(
    join(IOS_ASSETS, 'Splash.imageset', 'Contents.json'),
    JSON.stringify(
      {
        images: [
          {
            filename: 'splash-2732x2732.png',
            idiom: 'universal',
          },
        ],
        info: {
          author: 'xcode',
          version: 1,
        },
      },
      null,
      2
    )
  );
  console.log('✓ Splash.imageset Contents.json written.');
  console.log('\niOS brand assets generated successfully!');
}

main().catch((err) => {
  console.error('Error generating iOS brand assets:', err);
  process.exit(1);
});
