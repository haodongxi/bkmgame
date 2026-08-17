#!/usr/bin/env bash
# 将当前 bkmgame 数据同步到相邻的 bkmserver。
# Created by haodongsheng
set -euo pipefail

GAME_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_ROOT="${BKMSERVER_ROOT:-$(cd "$(dirname "$GAME_ROOT")/bkmserver" && pwd)}"

if [ ! -f "$SERVER_ROOT/tools/export_data.js" ]; then
  echo "找不到 bkmserver 导出脚本：$SERVER_ROOT/tools/export_data.js" >&2
  exit 1
fi

BKMGAME_ROOT="$GAME_ROOT" node "$SERVER_ROOT/tools/export_data.js" "$SERVER_ROOT/data"
