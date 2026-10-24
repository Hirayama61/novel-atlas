// 1 話の本文の句読点・要注意語の全件(CI を落とすものと、分類のための候補 TTE・C2)を出す。
//   DATA_DIR=... pnpm lint-text works/<作品>/episodes/<NNN>/text.md
// punctuation-reviewer が候補の全数分類に使う。旧 check.pl と同じ出力の並び。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { countChars } from "../src/core/check/text";
import { lintPunctuation, parseVocab } from "../src/core/lint/punctuation";
import { requireDataDir } from "./lib/data-dir";

const rel = process.argv[2];
if (!rel) {
  console.error("usage: pnpm lint-text works/<作品>/episodes/<NNN>/text.md");
  process.exit(2);
}
const dir = requireDataDir();
const work = /^works\/([^/]+)\//.exec(rel)?.[1];
const read = (p: string) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), "utf8") : "");
const vocab = parseVocab(
  `${read("craft/lint/vocab.tsv")}\n${work ? read(`works/${work}/lint/vocab.tsv`) : ""}`,
);
const hits = lintPunctuation(readFileSync(join(dir, rel), "utf8"), vocab);

const TITLES = {
  S4: "読点で終わる行(ゼロであること)",
  VOCAB: "要注意語(意図的例外以外は置換)",
  FRAG: "断片終止(原則除去)",
  TTE: "「、って」(1 件ずつ判定)",
  C2: "読点 2 つ以上の文(全数。1 文ずつ 保険/意図 を分類する)",
} as const;
for (const kind of Object.keys(TITLES) as (keyof typeof TITLES)[]) {
  const hs = hits.filter((h) => h.kind === kind);
  console.log(`== [${kind}] ${TITLES[kind]} ==`);
  if (!hs.length) console.log("なし");
  for (const h of hs) console.log(`L${h.line} | ${h.detail ? `${h.detail} | ` : ""}${h.text}`);
  console.log("");
}
const n = (k: string) => hits.filter((h) => h.kind === k).length;
console.log(
  `計: S4=${n("S4")} VOCAB=${n("VOCAB")} FRAG=${n("FRAG")} TTE=${n("TTE")} C2=${n("C2")}`,
);

// 字数(work.yaml の length と比べる)
const text = readFileSync(join(dir, rel), "utf8");
const length = work
  ? ((
      parseYaml(read(`works/${work}/work.yaml`)) as {
        length?: { target_chars: number; max_chars: number };
      }
    )?.length ?? null)
  : null;
const chars = countChars(text);
console.log(
  `字数: ${chars}${length ? ` / 目標 ${length.target_chars} / 上限 ${length.max_chars}${chars > length.max_chars ? "(上限超過)" : ""}` : ""}`,
);
