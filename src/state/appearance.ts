export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "ui.colorScheme";

export function getColorScheme(): ColorScheme {
	if (typeof window === "undefined") return "light";
	return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function applyColorScheme(scheme: ColorScheme) {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.theme = scheme;
	document.documentElement.style.colorScheme = scheme;
	window.localStorage.setItem(STORAGE_KEY, scheme);
}

export function initColorScheme() {
	applyColorScheme(getColorScheme());
}

export function toggleColorScheme(): ColorScheme {
	const next: ColorScheme = getColorScheme() === "dark" ? "light" : "dark";
	applyColorScheme(next);
	return next;
}
