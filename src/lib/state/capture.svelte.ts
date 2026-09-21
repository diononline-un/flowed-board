// Global Quick-Capture UI state (SPEC 3.1: src/lib/state). The sheet itself
// is mounted once in the app layout; the tab-bar FAB, the sidebar input and
// the Cmd/Ctrl+K shortcut all just open it here.
let sheetOpen = $state(false);
let initialText = $state('');

export const captureState = {
	get open(): boolean {
		return sheetOpen;
	},
	get initialText(): string {
		return initialText;
	}
};

export function openCapture(text = ''): void {
	initialText = text;
	sheetOpen = true;
}

export function closeCapture(): void {
	sheetOpen = false;
	initialText = '';
}
