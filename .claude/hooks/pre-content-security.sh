#!/usr/bin/env bash
# PreToolUse hook: ファイルコンテンツセキュリティチェック
# Write/Edit/MultiEdit 時にシークレット・TS全体無効化コメントを検出

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // ""')

case "$tool" in
  Write)
    content=$(echo "$input" | jq -r '.tool_input.content // ""')
    file=$(echo "$input" | jq -r '.tool_input.file_path // ""')
    ;;
  Edit)
    content=$(echo "$input" | jq -r '.tool_input.new_string // ""')
    file=$(echo "$input" | jq -r '.tool_input.file_path // ""')
    ;;
  MultiEdit)
    content=$(echo "$input" | jq -r '[.tool_input.edits[]?.new_string // ""] | join("\n")')
    file=$(echo "$input" | jq -r '.tool_input.file_path // ""')
    ;;
  *)
    exit 0
    ;;
esac

# シークレットパターン検出
if echo "$content" | grep -qE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|AKIA[A-Z0-9]{16}|glpat-[A-Za-z0-9_-]{20,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----)'; then
  echo "【セキュリティ】ファイルにシークレットキーが含まれている可能性があります: $file" >&2
  echo "環境変数を使用してください。意図的な場合は実装を見直してください。" >&2
  exit 2
fi

# @ts-nocheck 検出（TypeScript全体の型チェック無効化）
if [[ "$file" =~ \.(ts|tsx)$ ]]; then
  if echo "$content" | grep -qE '@ts-nocheck'; then
    echo "【品質ゲート】@ts-nocheck はTypeScriptチェックを全無効化します。型エラーを正しく修正してください: $file" >&2
    exit 2
  fi
fi
