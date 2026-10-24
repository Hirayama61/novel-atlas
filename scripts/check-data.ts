// データリポジトリの検査。Actions と執筆ルーティンの両方がこれを呼ぶ。
//   DATA_DIR=... pnpm check-data [--only schema,design,lint,canon,feedback] [--work <id>] [--episode <N>] [--json]
// error が 1 件でもあれば終了コード 1。

import { createHash } from "node:crypto";
import { checkCanon } from "../src/core/check/canon";
import { checkClaims } from "../src/core/check/claims";
import { checkDesign, checkRealization } from "../src/core/check/design";
import { checkFeedback, checkLength, lintWork } from "../src/core/check/lint";
import type { Finding } from "../src/core/data/work";
import { loadDataDir, requireDataDir } from "./lib/data-dir";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = new Set((opt("only") ?? "schema,design,lint,canon,feedback").split(","));
const workFilter = opt("work");
const epFilter = opt("episode") ? Number(opt("episode")) : undefined;

/** git hash-object と同じ blob SHA(claims.yaml の text_sha と照合する) */
function gitBlobSha(text: string): string {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

const { data, findings: schemaFindings, lint } = loadDataDir(requireDataDir());
const findings: Finding[] = [];
if (only.has("schema")) findings.push(...schemaFindings);

for (const w of data.works.values()) {
  if (workFilter && w.id !== workFilter) continue;
  if (only.has("design")) {
    for (const ep of w.episodes.values()) {
      if (epFilter !== undefined && ep.no !== epFilter) continue;
      if (ep.design) findings.push(...checkDesign(w, ep.design));
    }
  }
  if (only.has("lint")) findings.push(...lintWork(w, lint, epFilter), ...checkLength(w, epFilter));
  if (only.has("canon")) {
    findings.push(...checkCanon(w));
    findings.push(...checkClaims(w, gitBlobSha, epFilter));
    for (const ep of w.episodes.values()) {
      if (epFilter !== undefined && ep.no !== epFilter) continue;
      if (ep.design && ep.text && ep.design.status !== "published")
        findings.push(...checkRealization(w, ep.design, ep.text));
    }
  }
  if (only.has("feedback")) findings.push(...checkFeedback(w, lint));
}

if (args.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const order = { error: 0, warning: 1 } as const;
  for (const f of findings.sort(
    (a, b) => order[a.level] - order[b.level] || a.path.localeCompare(b.path),
  )) {
    const loc = f.line ? `${f.path}:${f.line}` : f.path;
    console.log(`${f.level === "error" ? "✗" : "△"} [${f.check}] ${loc} ${f.message}`);
  }
  const e = findings.filter((f) => f.level === "error").length;
  console.log(`\nerror ${e} / warning ${findings.length - e}`);
}
process.exit(findings.some((f) => f.level === "error") ? 1 : 0);
