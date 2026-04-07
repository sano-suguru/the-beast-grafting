import { User } from "lucide-preact";
import type { AuthProvider } from "../../../shared/auth-provider";
import {
  playerDisplayName,
  playerProviders,
  showAccountOverlay,
  authLoading,
  authInitFailed,
} from "../../state/auth-store";
import { DiscordIcon, GoogleIcon } from "../../components/provider-icon";

function ProviderBadges({ providers }: { providers: readonly AuthProvider[] }) {
  return (
    <>
      {providers.includes("discord") && <DiscordIcon className="h-3 w-3 text-[#5865F2]" />}
      {providers.includes("google") && <GoogleIcon className="h-3 w-3" />}
    </>
  );
}

export function IdentityBadge() {
  const loading = authLoading.value;
  const name = playerDisplayName.value;
  const providers = playerProviders.value;
  const failed = authInitFailed.value;

  if (loading) {
    return (
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-[10px] text-zinc-600">
        <User size={12} />
        <span className="animate-pulse">…</span>
      </div>
    );
  }
  if (name === null && !failed) return null;

  let label = name ?? "ゲスト";
  if (failed) label = "接続エラー";

  return (
    <button
      type="button"
      onClick={() => {
        showAccountOverlay.value = true;
      }}
      className="absolute top-4 right-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
    >
      <User size={12} />
      <span className="max-w-[80px] truncate">{label}</span>
      <ProviderBadges providers={providers} />
    </button>
  );
}
