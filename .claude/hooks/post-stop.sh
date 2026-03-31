#!/usr/bin/env bash
# Stop hook: コード編集があった場合のみ pnpm check を実行

if [[ ! -f .claude/.edited ]]; then
  exit 0
fi

rm -f .claude/.edited
pnpm check
