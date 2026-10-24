#!/usr/bin/env bash
# 隔離レビュアーを、隔離バンドルだけを作業ディレクトリにした別プロセスで起動する(設計 05 の案 A)。
#   DATA_DIR=... scripts/run-isolated.sh <reader|slush|scorer|codex|codex-scorer> <作品> <話数> <出力ファイル> [ブランチ] [指示の追記]
# 終了コード 3 = この環境で隔離プロセスを起動できなかった。呼び出し側はサブエージェント(案 C)に倒し、その旨を記録する。
set -euo pipefail
cd "$(dirname "$0")/.."

role="$1"
work="$2"
ep="$3"
out="$4"
ref="${5:-}"
extra="${6:-}"
: "${DATA_DIR:?DATA_DIR が必要です}"

bundle="$(mktemp -d "${TMPDIR:-/tmp}/atlas-bundle.XXXXXX")"
trap 'rm -rf "$bundle"' EXIT
pnpm -s isolate --work "$work" --upto "$ep" --role "$role" --out "$bundle" ${ref:+--ref "$ref"} >/dev/null

case "$role" in
reader) agent=reader-experience-reviewer ;;
slush) agent=slush-reader-reviewer ;;
scorer) agent=rubric-scorer ;;
codex) agent=reader-experience-reviewer ;;
codex-scorer) agent=rubric-scorer ;;
*)
  echo "未知の役割: $role" >&2
  exit 2
  ;;
esac
# エージェント定義の本文(frontmatter を除く)をシステムプロンプトに足す
prompt="$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' ".claude/agents/$agent.md")"
task="作業ディレクトリの隔離バンドルを読み、手順どおりに報告せよ。対象は第${ep}話。${extra}"

if [ "$role" = "codex" ] || [ "$role" = "codex-scorer" ]; then
  command -v codex >/dev/null || exit 3
  # Codex は読み取り専用のサンドボックスで、バンドルを作業ディレクトリにして動かす。
  # サンドボックスはバンドル外の読み取りまでは止めないので、指示でも外を読まないよう縛る(05 に記載の限界)。
  (cd "$bundle" && codex exec --skip-git-repo-check --sandbox read-only "${prompt}

${task}") >"$out" 2>"$out.log" || exit 3
  exit 0
fi

command -v claude >/dev/null || exit 3
model="$(awk -F': *' '/^model:/{print $2; exit}' ".claude/agents/$agent.md")"
# 作業ディレクトリ外の読み取りは非対話モードでは許可が出ないので、バンドルの外は読めない
(cd "$bundle" && claude -p "$task" \
  --model "${model:-opus}" \
  --append-system-prompt "$prompt" \
  --allowedTools "Read" "Glob" \
  --disallowedTools "Bash" "Edit" "Write" "WebFetch" "WebSearch" \
  </dev/null) >"$out" 2>"$out.log" || exit 3
