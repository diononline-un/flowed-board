import { diffDays } from './date.js';
import type { Horizon } from './types.js';

// Effective horizon (SPEC 5.2), verbatim rules: an explicit override always
// wins; otherwise the date (or target_date for goals) decides — <= 14 days
// (including the past) is short, <= 90 is mid, everything beyond is long.
// No date at all means short. Only the server computes "today" (SPEC 5.1).
export function effectiveHorizon(
	item: {
		horizon_override: Horizon | null;
		date?: string | null;
		target_date?: string | null;
	},
	today: string
): Horizon {
	if (item.horizon_override) return item.horizon_override;
	const d = item.date ?? item.target_date;
	if (!d) return 'short';
	const n = diffDays(d, today); // d − today, past is negative
	if (n <= 14) return 'short'; // includes the past
	if (n <= 90) return 'mid';
	return 'long';
}
