#!/usr/bin/env bash
# PreToolUse hook: Bash コマンドセキュリティチェック
# - git --no-verify ブロック
# - コマンド引数内のシークレットパターン検出

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# git --no-verify ブロック
if echo "$command" | grep -qE 'git\s+(commit|push).*--no-verify'; then
  echo "【セキュリティ】--no-verify は禁止です。フック失敗の根本原因を修正してください。" >&2
  exit 2
fi

# コマンド引数内のシークレットパターン検出
if echo "$command" | grep -qE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|AKIA[A-Z0-9]{16}|glpat-[A-Za-z0-9_-]{20,})'; then
  echo "【セキュリティ】コマンドにシークレットキーが含まれている可能性があります。環境変数を使用してください。" >&2
  exit 2
fi
