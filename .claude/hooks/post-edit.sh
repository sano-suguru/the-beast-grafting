#!/usr/bin/env bash
# PostToolUse hook: auto-format & lint edited files

file=$(jq -r '.tool_input.file_path // .tool_response.filePath')

if [[ "$file" =~ \.(ts|tsx|js|jsx|json|css|html)$ ]]; then
  pnpm fmt "$file"
  pnpm lint "$file"
fi
