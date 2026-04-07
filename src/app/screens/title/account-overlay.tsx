import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { OAuthProvider } from "../../../shared/auth-provider";
import { X, LogOut, Pencil, Check } from "lucide-preact";
import {
  playerDisplayName,
  playerProviders,
  showAccountOverlay,
  authError,
  editingName,
} from "../../state/auth-store";
import {
  loginWithProvider,
  logoutAction,
  renameAction,
  authErrorMessage,
} from "../../state/auth-actions";
import { DiscordIcon, GoogleIcon } from "../../components/provider-icon";

function AuthErrorBanner() {
  const code = authError.value;
  if (!code) return null;
  return (
    <div className="flex items-center justify-between border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-400">
      <span>{authErrorMessage(code)}</span>
      <button
        type="button"
        className="cursor-pointer text-red-600 hover:text-red-400"
        onClick={() => {
          authError.value = null;
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ProviderButton({
  provider,
  linked,
  isGuest,
}: {
  provider: OAuthProvider;
  linked: boolean;
  isGuest: boolean;
}) {
  const label = provider === "discord" ? "Discord" : "Google";
  const Icon = provider === "discord" ? DiscordIcon : GoogleIcon;

  if (linked) {
    return (
      <div className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
        <Icon className="h-4 w-4" />
        <span>{label} 連携済み</span>
      </div>
    );
  }

  const action = isGuest ? "でログイン" : "を連携";

  return (
    <button
      type="button"
      onClick={() => loginWithProvider(provider)}
      className="flex cursor-pointer items-center gap-2 border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"
    >
      <Icon className="h-4 w-4" />
      <span>
        {label}
        {action}
      </span>
    </button>
  );
}

function NameEditForm({ name }: { name: string | null }) {
  const saving = useSignal(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    const value = inputRef.current?.value.trim();
    if (!value || value === name) {
      editingName.value = false;
      return;
    }
    saving.value = true;
    const result = await renameAction(value);
    saving.value = false;
    if (result.isOk()) editingName.value = false;
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        defaultValue={name ?? ""}
        maxLength={20}
        disabled={saving.value}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSave();
          if (e.key === "Escape") {
            editingName.value = false;
          }
        }}
        className="w-full border border-zinc-700 bg-zinc-900 px-2 py-1 font-serif text-sm text-zinc-200 outline-none focus:border-zinc-500"
      />
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving.value}
        className="cursor-pointer p-1 text-zinc-500 hover:text-zinc-300"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          editingName.value = false;
        }}
        className="cursor-pointer p-1 text-zinc-600 hover:text-zinc-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function DisplayNameSection({ name, isGuest }: { name: string | null; isGuest: boolean }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest text-zinc-600">表示名</p>
      {editingName.value ? (
        <NameEditForm name={name} />
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <p className="font-serif text-sm text-zinc-200">{name ?? "ゲスト"}</p>
          {!isGuest && (
            <button
              type="button"
              onClick={() => {
                editingName.value = true;
              }}
              className="cursor-pointer text-zinc-600 hover:text-zinc-400"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderSection({ isGuest }: { isGuest: boolean }) {
  const providers = playerProviders.value;

  return (
    <div className="space-y-2">
      <p className="text-[10px] tracking-widest text-zinc-600">
        {isGuest ? "ログイン" : "連携済みサービス"}
      </p>
      <div className="flex flex-col gap-2">
        <ProviderButton
          provider="discord"
          linked={providers.includes("discord")}
          isGuest={isGuest}
        />
        <ProviderButton provider="google" linked={providers.includes("google")} isGuest={isGuest} />
      </div>
      {isGuest && (
        <p className="text-[10px] leading-relaxed text-zinc-600">
          ログインするとデータが保護され、別の端末からもアクセスできます。
        </p>
      )}
    </div>
  );
}

export function AccountOverlay() {
  const name = playerDisplayName.value;
  const isGuest = playerProviders.value.length === 0;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) showAccountOverlay.value = false;
      }}
    >
      <div className="relative mx-4 flex w-full max-w-xs flex-col gap-4 border border-zinc-800 bg-zinc-950 p-5">
        <button
          type="button"
          onClick={() => {
            showAccountOverlay.value = false;
          }}
          className="absolute top-3 right-3 cursor-pointer text-zinc-600 hover:text-zinc-300"
        >
          <X size={16} />
        </button>

        <DisplayNameSection name={name} isGuest={isGuest} />

        <AuthErrorBanner />
        <ProviderSection isGuest={isGuest} />

        {!isGuest && (
          <button
            type="button"
            onClick={() => void logoutAction()}
            className="mt-2 flex cursor-pointer items-center justify-center gap-2 border border-zinc-800 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            <LogOut size={14} />
            <span>ログアウト</span>
          </button>
        )}
      </div>
    </div>
  );
}
