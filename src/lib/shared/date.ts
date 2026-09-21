// Pure date helpers (SPEC 5.1). All arithmetic runs on YYYY-MM-DD strings via
// Date.UTC; timezones are only ever resolved through Intl.DateTimeFormat.
// No external date library by design.

export type WeekStartDay = 0 | 1 | 6; // JS getDay(): 0=Sunday, 1=Monday, 6=Saturday
export type FormatDeStyle = 'short' | 'long' | 'dayMonth';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

interface YmdParts {
	y: number;
	m: number;
	d: number;
}

function parts(ymd: string): YmdParts {
	const match = YMD_RE.exec(ymd);
	if (!match) throw new TypeError(`invalid YYYY-MM-DD string: ${ymd}`);
	return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function toYmd(ms: number): string {
	const dt = new Date(ms);
	return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

// Date.UTC maps years 0–99 onto 1900+year; setUTCFullYear does not.
function utcMs(y: number, m: number, d: number): number {
	const dt = new Date(0);
	dt.setUTCFullYear(y, m - 1, d);
	return dt.getTime();
}

function utcOf(ymd: string): number {
	const { y, m, d } = parts(ymd);
	return utcMs(y, m, d);
}

export function isValidYmd(ymd: string): boolean {
	const match = YMD_RE.exec(ymd);
	if (!match) return false;
	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	if (m < 1 || m > 12 || d < 1 || d > 31) return false;
	const dt = new Date(utcMs(y, m, d));
	return (
		dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
	);
}

export function isValidTimeZone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

// Calendar day in the given IANA timezone as YYYY-MM-DD.
export function todayIn(tz: string, now: Date = new Date()): string {
	const p = zonedParts(tz, now);
	return `${p.year}-${p.month}-${p.day}`;
}

// Wall clock in the given IANA timezone as HH:MM (24h).
export function nowTimeIn(tz: string, now: Date = new Date()): string {
	const p = zonedParts(tz, now);
	const hour = p.hour === '24' ? '00' : p.hour;
	return `${hour}:${p.minute}`;
}

function zonedParts(tz: string, now: Date): Record<string, string> {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
	const out: Record<string, string> = {};
	for (const part of fmt.formatToParts(now)) {
		if (part.type !== 'literal') out[part.type] = part.value;
	}
	return out;
}

// Day of week 0–6 (0 = Sunday), computed on the UTC calendar day.
export function weekdayOf(ymd: string): number {
	return new Date(utcOf(ymd)).getUTCDay();
}

export function addDays(ymd: string, n: number): string {
	return toYmd(utcOf(ymd) + n * DAY_MS);
}

// a − b in whole calendar days (negative when a lies before b).
export function diffDays(a: string, b: string): number {
	return Math.round((utcOf(a) - utcOf(b)) / DAY_MS);
}

// First day of the week containing ymd for the given week start.
export function weekStart(ymd: string, weekStartDay: WeekStartDay): string {
	const delta = (weekdayOf(ymd) - weekStartDay + 7) % 7;
	return addDays(ymd, -delta);
}

export function monthStart(ymd: string): string {
	const { y, m } = parts(ymd);
	return `${String(y).padStart(4, '0')}-${pad2(m)}-01`;
}

export function monthEnd(ymd: string): string {
	const { y, m } = parts(ymd);
	// Day 0 of the next month is the last day of this month.
	return toYmd(utcMs(y, m + 1, 0));
}

// ISO-8601 week number (weeks start Monday, week 1 contains the first Thursday).
export function isoWeekNumber(ymd: string): number {
	const dt = new Date(utcOf(ymd));
	const day = dt.getUTCDay() || 7; // Monday=1 … Sunday=7
	dt.setUTCDate(dt.getUTCDate() + 4 - day); // Thursday of the same week
	const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
	return Math.ceil(((dt.getTime() - yearStart) / DAY_MS + 1) / 7);
}

// German formatting, e.g. short: "Mo., 21. Sep." — long: "Montag, 21. September 2026".
// Noon UTC keeps the calendar day stable for any local renderer timezone.
export function formatDe(ymd: string, style: FormatDeStyle = 'short'): string {
	const { y, m, d } = parts(ymd);
	const dt = new Date(Date.UTC(y, m - 1, d, 12));
	if (style === 'long') {
		return new Intl.DateTimeFormat('de-DE', {
			timeZone: 'UTC',
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(dt);
	}
	if (style === 'dayMonth') {
		return new Intl.DateTimeFormat('de-DE', {
			timeZone: 'UTC',
			day: 'numeric',
			month: 'short'
		}).format(dt);
	}
	return new Intl.DateTimeFormat('de-DE', {
		timeZone: 'UTC',
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	}).format(dt);
}
