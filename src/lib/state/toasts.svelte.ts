// Global toast state (SPEC 3.1: src/lib/state). Toasts auto-dismiss; the
// undo toasts for delete/done live for 8 s (SPEC 1.3 P5).

export interface ToastAction {
	label: string;
	run: () => void | Promise<void>;
}

export interface ToastItem {
	id: number;
	message: string;
	action: ToastAction | null;
	durationMs: number;
	isError: boolean;
}

const UNDO_DURATION_MS = 8000;
const ERROR_DURATION_MS = 6000;
const INFO_DURATION_MS = 4000;

let toasts = $state<ToastItem[]>([]);
let nextId = 1;

export const toastStore = {
	get items(): ToastItem[] {
		return toasts;
	}
};

export function pushToast(
	message: string,
	options: { action?: ToastAction; durationMs?: number; isError?: boolean } = {}
): number {
	const id = nextId++;
	const item: ToastItem = {
		id,
		message,
		action: options.action ?? null,
		durationMs:
			options.durationMs ??
			(options.isError ? ERROR_DURATION_MS : options.action ? UNDO_DURATION_MS : INFO_DURATION_MS),
		isError: options.isError ?? false
	};
	toasts = [...toasts, item];
	setTimeout(() => dismissToast(id), item.durationMs);
	return id;
}

export function pushErrorToast(message: string): number {
	return pushToast(message, { isError: true });
}

export function dismissToast(id: number): void {
	toasts = toasts.filter((toast) => toast.id !== id);
}
