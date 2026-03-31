#!/usr/bin/env bash
# PostToolUse hook: auto-format & lint edited files

file=$(jq -r '.tool_input.file_path // .tool_response.filePath')

if [[ "$file" =~ \.(ts|tsx|js|jsx|json|css|html)$ ]]; then
  pnpm fmt "$file"
  pnpm lint "$file" --fix
fi

# セクションディバイダー検出
if [[ "$file" =~ \.(ts|tsx|js|jsx)$ ]]; then
  match=$(grep -nE '^\s*//.*(---|===|~~~|\*\*\*){3,}' "$file" 2>/dev/null)
  if [[ -n "$match" ]]; then
    echo "セクションディバイダーが検出されました。関数定義と空行で区切ってください:" >&2
    echo "$match" >&2
    exit 2
  fi
fi

# Stop hook用マーカー
touch .claude/.edited
