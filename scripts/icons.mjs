// Generates the PWA icons from static/icon.svg into static/icons/ (SPEC 13.2).
// Runs automatically before every `npm run build` via the prebuild hook.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const outDir = join(process.cwd(), 'static', 'icons');
const targets = [
	{ name: 'icon-192.png', size: 192 },
	{ name: 'icon-512.png', size: 512 },
	{ name: 'apple-touch-icon-180.png', size: 180 }
];

const svg = await readFile(join(process.cwd(), 'static', 'icon.svg'));
await mkdir(outDir, { recursive: true });

for (const { name, size } of targets) {
	await sharp(svg, { density: 384 })
		.resize(size, size)
		.png()
		.toFile(join(outDir, name));
}

console.log(`icons: generated ${targets.length} files in static/icons/`);
