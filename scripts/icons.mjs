// Generates the PWA icons from static/icon.svg into static/icons/ (SPEC 13.2).
// Runs automatically before every `npm run build` via the prebuild hook; the
// generated PNGs are committed (M7 brief) so a checkout ships a complete
// manifest without a build step.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const PAPER = '#FBF6EE'; // SPEC 10.1 --color-paper (manifest background_color)
const outDir = join(process.cwd(), 'static', 'icons');

const targets = [
	{ name: 'icon-192.png', size: 192 },
	{ name: 'icon-512.png', size: 512 },
	{ name: 'apple-touch-icon-180.png', size: 180 }
];

// Maskable icons are cropped to a circle by Android: everything important has
// to sit inside the 80 % safe zone, so the artwork is scaled down and padded
// with the paper colour instead of being drawn edge to edge.
const maskable = { name: 'icon-512-maskable.png', size: 512, safeRatio: 0.8 };

const svg = await readFile(join(process.cwd(), 'static', 'icon.svg'));
await mkdir(outDir, { recursive: true });

for (const { name, size } of targets) {
	await sharp(svg, { density: 384 })
		.resize(size, size)
		.png()
		.toFile(join(outDir, name));
}

const inner = Math.round(maskable.size * maskable.safeRatio);
await sharp(svg, { density: 384 })
	.resize(inner, inner)
	.extend({
		top: Math.round((maskable.size - inner) / 2),
		bottom: maskable.size - inner - Math.round((maskable.size - inner) / 2),
		left: Math.round((maskable.size - inner) / 2),
		right: maskable.size - inner - Math.round((maskable.size - inner) / 2),
		background: PAPER
	})
	.png()
	.toFile(join(outDir, maskable.name));

console.log(`icons: generated ${targets.length + 1} files in static/icons/`);
