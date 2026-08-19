/**
 * Mega Tehnik Elektronik - Complete Brand Asset Generator
 * Generates all Android & PWA icons, splash screens, and web assets.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER_UPLOADED_DIR = 'C:/Users/adens/.gemini/antigravity-ide/brain/51c20ecf-ea56-40fe-817c-a7b3f90ebb5b/.user_uploaded/';
const ICON_RAW_SOURCE = join(USER_UPLOADED_DIR, 'media_1787145937724.jpg');
const MASCOT_SOURCE = join(ROOT, 'design-assets', 'Logo Mega Teknik.png');

// Colors from brand guide
const COLORS = {
  blueDark: '#0D47A1',
  bluePrimary: '#1565C0',
  blueLight: '#2196F3',
  blueSoft: '#90CAF9',
  bgDark: '#0b1329',
  bgDarker: '#060a17',
  cardDark: '#0f172a',
  white: '#FFFFFF',
};

// Subtle Circuit Pattern SVG definition
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
  
  <!-- Subtle Circuit Lines -->
  <g stroke="#2196F3" stroke-opacity="0.12" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top left circuit -->
    <path d="M 0 ${h * 0.15} H ${w * 0.25} L ${w * 0.35} ${h * 0.22} H ${w * 0.42} V ${h * 0.3}"/>
    <circle cx="${w * 0.42}" cy="${h * 0.3}" r="3.5" fill="#2196F3" fill-opacity="0.25"/>
    <path d="M ${w * 0.1} 0 V ${h * 0.08} L ${w * 0.18} ${h * 0.14} V ${h * 0.25}"/>
    <circle cx="${w * 0.18}" cy="${h * 0.25}" r="3" fill="#2196F3" fill-opacity="0.25"/>
    
    <!-- Top right circuit -->
    <path d="M ${w} ${h * 0.18} H ${w * 0.75} L ${w * 0.65} ${h * 0.25} H ${w * 0.58} V ${h * 0.32}"/>
    <circle cx="${w * 0.58}" cy="${h * 0.32}" r="3.5" fill="#2196F3" fill-opacity="0.25"/>
    <path d="M ${w * 0.88} 0 V ${h * 0.09} L ${w * 0.8} ${h * 0.15} V ${h * 0.28}"/>
    <circle cx="${w * 0.8}" cy="${h * 0.28}" r="3" fill="#2196F3" fill-opacity="0.25"/>
    
    <!-- Middle circuit traces -->
    <path d="M 0 ${h * 0.45} H ${w * 0.18} L ${w * 0.24} ${h * 0.5} H ${w * 0.3}"/>
    <circle cx="${w * 0.3}" cy="${h * 0.5}" r="3" fill="#2196F3" fill-opacity="0.2"/>
    <path d="M ${w} ${h * 0.48} H ${w * 0.82} L ${w * 0.76} ${h * 0.53} H ${w * 0.7}"/>
    <circle cx="${w * 0.7}" cy="${h * 0.53}" r="3" fill="#2196F3" fill-opacity="0.2"/>
    
    <!-- Bottom left & right circuit -->
    <path d="M 0 ${h * 0.78} H ${w * 0.22} L ${w * 0.3} ${h * 0.72} H ${w * 0.38}"/>
    <circle cx="${w * 0.38}" cy="${h * 0.72}" r="3" fill="#2196F3" fill-opacity="0.2"/>
    <path d="M ${w} ${h * 0.8} H ${w * 0.78} L ${w * 0.68} ${h * 0.73} H ${w * 0.6}"/>
    <circle cx="${w * 0.6}" cy="${h * 0.73}" r="3" fill="#2196F3" fill-opacity="0.2"/>
  </g>
</svg>
`;

async function generateAssets() {
  console.log('--- Generating Brand Assets for Mega Tehnik Elektronik ---');

  // Ensure directories exist
  const dirs = [
    join(ROOT, 'public', 'pwa'),
    join(ROOT, 'design-assets'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-port-mdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-port-hdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-port-xhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-port-xxhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-port-xxxhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-land-mdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-land-hdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-land-xhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-land-xxhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable-land-xxxhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-xhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi'),
    join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi'),
  ];

  for (const d of dirs) {
    await mkdir(d, { recursive: true });
  }

  // 1. Process Master App Icon
  // Crop the squircle icon from media_1787145937724.jpg { left: 98, top: 86, width: 828, height: 832 }
  const croppedIconBuffer = await sharp(ICON_RAW_SOURCE)
    .extract({ left: 98, top: 86, width: 828, height: 832 })
    .resize(1024, 1024, { fit: 'fill' })
    .png()
    .toBuffer();

  await sharp(croppedIconBuffer).toFile(join(ROOT, 'design-assets', 'app-icon-1024.png'));
  console.log('✓ Master App Icon (1024x1024) generated.');

  // Create rounded squircle mask for standard icon
  const roundedMaskSvg = (size, r) => Buffer.from(`
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#ffffff"/>
    </svg>
  `);

  // Create circle mask for round icons
  const circleMaskSvg = (size) => Buffer.from(`
    <svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
    </svg>
  `);

  // Generate standard squircle 512 & 192 icons for PWA
  const icon512 = await sharp(croppedIconBuffer)
    .resize(512, 512)
    .png()
    .toBuffer();

  await sharp(icon512).toFile(join(ROOT, 'public', 'pwa', 'icon-512.png'));
  await sharp(icon512).webp({ quality: 92 }).toFile(join(ROOT, 'public', 'pwa', 'icon-512.webp'));

  const icon192 = await sharp(croppedIconBuffer)
    .resize(192, 192)
    .png()
    .toBuffer();

  await sharp(icon192).toFile(join(ROOT, 'public', 'pwa', 'icon-192.png'));
  await sharp(icon192).webp({ quality: 92 }).toFile(join(ROOT, 'public', 'pwa', 'icon-192.webp'));

  // Apple touch icon (180x180)
  await sharp(croppedIconBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(ROOT, 'public', 'pwa', 'apple-touch-icon.png'));

  // Maskable icon: Needs safe padding (80% scale centered on gradient background)
  const maskableBg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="mBg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#1565C0"/>
          <stop offset="70%" stop-color="#0D47A1"/>
          <stop offset="100%" stop-color="#060d1f"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#mBg)"/>
    </svg>
  `);

  const scaledIcon380 = await sharp(croppedIconBuffer)
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const maskable512 = await sharp(maskableBg)
    .composite([{ input: scaledIcon380, top: 56, left: 56 }])
    .png()
    .toBuffer();

  await sharp(maskable512).toFile(join(ROOT, 'public', 'pwa', 'icon-maskable-512.png'));
  await sharp(maskable512).webp({ quality: 92 }).toFile(join(ROOT, 'public', 'pwa', 'icon-maskable-512.webp'));
  console.log('✓ PWA Icons (192, 512, maskable, apple-touch) generated.');

  // Favicon (64x64 PNG + SVG)
  await sharp(croppedIconBuffer)
    .resize(64, 64)
    .png()
    .toFile(join(ROOT, 'public', 'favicon.png'));

  // Favicon SVG
  const faviconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="fBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1565C0"/>
        <stop offset="100%" stop-color="#0D47A1"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="28" fill="url(#fBg)"/>
    <path d="M64 24 L74 44 L96 48 L80 64 L84 86 L64 76 L44 86 L48 64 L32 48 L54 44 Z" fill="#FFFFFF" opacity="0.15"/>
    <path d="M42 38 L86 82 M86 38 L42 82" stroke="#60A5FA" stroke-width="8" stroke-linecap="round"/>
    <circle cx="64" cy="60" r="28" fill="#2196F3" stroke="#FFFFFF" stroke-width="4"/>
    <text x="64" y="68" font-family="Arial, sans-serif" font-weight="900" font-size="24" fill="#FFFFFF" text-anchor="middle">MT</text>
  </svg>
  `;
  await writeFile(join(ROOT, 'public', 'favicon.svg'), faviconSvg.trim());

  // In-app Logo lockup (Mascot + Text)
  const mascotBuffer = await readFile(MASCOT_SOURCE);
  await sharp(mascotBuffer)
    .resize({ height: 500, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(join(ROOT, 'public', 'logo.webp'));

  // Android mipmap icons
  const mipmapSizes = [
    { dir: 'mipmap-mdpi', size: 48, r: 10 },
    { dir: 'mipmap-hdpi', size: 72, r: 16 },
    { dir: 'mipmap-xhdpi', size: 96, r: 22 },
    { dir: 'mipmap-xxhdpi', size: 144, r: 32 },
    { dir: 'mipmap-xxxhdpi', size: 192, r: 42 },
  ];

  for (const m of mipmapSizes) {
    const outDir = join(ROOT, 'android', 'app', 'src', 'main', 'res', m.dir);

    // Standard Icon
    await sharp(croppedIconBuffer)
      .resize(m.size, m.size)
      .png()
      .toFile(join(outDir, 'ic_launcher.png'));

    // Round Icon
    const roundMask = circleMaskSvg(m.size);
    await sharp(croppedIconBuffer)
      .resize(m.size, m.size)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(join(outDir, 'ic_launcher_round.png'));

    // Adaptive Foreground: Scaled centered character inside 108dp canvas (432x432 for xxxhdpi scale)
    const fgScale = Math.round(m.size * 0.72);
    const fgPadding = Math.round((m.size - fgScale) / 2);
    const fgMascot = await sharp(croppedIconBuffer)
      .resize(fgScale, fgScale)
      .png()
      .toBuffer();

    const fgCanvas = Buffer.from(`
      <svg width="${m.size}" height="${m.size}">
        <rect width="${m.size}" height="${m.size}" fill="none"/>
      </svg>
    `);

    await sharp(fgCanvas)
      .composite([{ input: fgMascot, top: fgPadding, left: fgPadding }])
      .png()
      .toFile(join(outDir, 'ic_launcher_foreground.png'));

    console.log(`✓ Android ${m.dir} icons generated.`);
  }

  // 2. Generate Native Splash Screens (Matching Mockup #4)
  // We composite:
  // - Circuit background
  // - Centered Mascot character
  // - Text lockup: "MEGA TEHNIK", "— ELEKTRONIK —", "Solusi Elektronik, Terpercaya!"
  // - Loading progress bar with "Memuat..."

  async function generateSplash(width, height, isLandscape = false) {
    const bgSvg = circuitBackgroundSvg(width, height);
    const bgBuf = await sharp(Buffer.from(bgSvg)).png().toBuffer();

    // Scale mascot relative to screen height/width
    const mascotTargetH = isLandscape
      ? Math.round(height * 0.45)
      : Math.round(height * 0.30);
    const mascotTargetW = Math.round((mascotTargetH * 2400) / 2990);

    const mascotResized = await sharp(mascotBuffer)
      .resize(mascotTargetW, mascotTargetH, { fit: 'contain' })
      .png()
      .toBuffer();

    const mascotTop = isLandscape
      ? Math.round(height * 0.12)
      : Math.round(height * 0.22);
    const mascotLeft = Math.round((width - mascotTargetW) / 2);

    // Text & Progress Bar SVG Overlay
    const textTop = mascotTop + mascotTargetH + (isLandscape ? 12 : 24);
    const barWidth = Math.min(Math.round(width * 0.65), 360);
    const barLeft = Math.round((width - barWidth) / 2);
    const barTop = isLandscape ? Math.round(height * 0.82) : Math.round(height * 0.84);

    const titleSize = Math.max(Math.round(width * 0.065), isLandscape ? 22 : 26);
    const subtitleSize = Math.max(Math.round(titleSize * 0.55), isLandscape ? 13 : 15);
    const sloganSize = Math.max(Math.round(titleSize * 0.45), isLandscape ? 11 : 13);

    const overlaySvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0D47A1"/>
          <stop offset="50%" stop-color="#2196F3"/>
          <stop offset="100%" stop-color="#90CAF9"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      <!-- Brand Title -->
      <text x="${width / 2}" y="${textTop + titleSize}" 
            font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${titleSize}" 
            fill="#FFFFFF" text-anchor="middle" letter-spacing="2">MEGA TEHNIK</text>
      
      <!-- Subtitle badge with horizontal divider lines -->
      <line x1="${width / 2 - 120}" y1="${textTop + titleSize + 22}" x2="${width / 2 - 70}" y2="${textTop + titleSize + 22}" stroke="#2196F3" stroke-width="2.5" stroke-linecap="round"/>
      <text x="${width / 2}" y="${textTop + titleSize + 27}" 
            font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${subtitleSize}" 
            fill="#2196F3" text-anchor="middle" letter-spacing="3">ELEKTRONIK</text>
      <line x1="${width / 2 + 70}" y1="${textTop + titleSize + 22}" x2="${width / 2 + 120}" y2="${textTop + titleSize + 22}" stroke="#2196F3" stroke-width="2.5" stroke-linecap="round"/>

      <!-- Slogan -->
      <text x="${width / 2}" y="${textTop + titleSize + 56}" 
            font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="${sloganSize}" 
            fill="#90CAF9" text-anchor="middle" letter-spacing="0.5">Solusi Elektronik, Terpercaya!</text>

      <!-- Progress Bar Container -->
      <rect x="${barLeft}" y="${barTop}" width="${barWidth}" height="8" rx="4" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
      <!-- Progress Bar Active (75% indicator for static splash) -->
      <rect x="${barLeft}" y="${barTop}" width="${barWidth * 0.72}" height="8" rx="4" fill="url(#barGrad)" filter="url(#glow)"/>

      <!-- Loading Text -->
      <text x="${width / 2}" y="${barTop + 24}" 
            font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="12" 
            fill="#94a3b8" text-anchor="middle" letter-spacing="1">Memuat...</text>
    </svg>
    `);

    const finalSplash = await sharp(bgBuf)
      .composite([
        { input: mascotResized, top: mascotTop, left: mascotLeft },
        { input: overlaySvg, top: 0, left: 0 },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    return finalSplash;
  }

  // Generate splash for Android sizes
  const portSizes = [
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const s of portSizes) {
    const splash = await generateSplash(s.w, s.h, false);
    await sharp(splash).toFile(join(ROOT, 'android', 'app', 'src', 'main', 'res', s.dir, 'splash.png'));
    console.log(`✓ Android Portrait Splash (${s.w}x${s.h}) -> ${s.dir}/splash.png`);
  }

  const landSizes = [
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  ];

  for (const s of landSizes) {
    const splash = await generateSplash(s.w, s.h, true);
    await sharp(splash).toFile(join(ROOT, 'android', 'app', 'src', 'main', 'res', s.dir, 'splash.png'));
    console.log(`✓ Android Landscape Splash (${s.w}x${s.h}) -> ${s.dir}/splash.png`);
  }

  // Base drawable splash (default portrait high-res)
  const baseSplash = await generateSplash(1080, 1920, false);
  await sharp(baseSplash).toFile(join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable', 'splash.png'));
  console.log('✓ Android Base splash.png generated.');

  console.log('\nAll brand assets generated successfully!');
}

generateAssets().catch((err) => {
  console.error('Error generating brand assets:', err);
  process.exit(1);
});
