import { signal } from "@preact/signals";
import type { AuthProvider } from "../../shared/auth-provider";

export const playerDisplayName = signal<string | null>(null);
export const playerProviders = signal<AuthProvider[]>([]);
export const showAccountOverlay = signal(false);
export const authError = signal<string | null>(null);
export const authLoading = signal(true);
export const authInitFailed = signal(false);
export const editingName = signal(false);
