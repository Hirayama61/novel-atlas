// データリポジトリの index.json を作り直す。マージ後同期ルーティンが呼ぶ。
//   DATA_DIR=... pnpm build-index

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex } from "../src/core/index-file";
import { loadDataDir, requireDataDir } from "./lib/data-dir";

const dir = requireDataDir();
const { data, findings } = loadDataDir(dir);
const bad = findings.filter((f) => f.level === "error");
if (bad.length) {
  for (const f of bad) console.error(`✗ ${f.path} ${f.message}`);
  console.error("スキーマのエラーがあるので index.json を書かない");
  process.exit(1);
}
const index = buildIndex(data);
writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`index.json: ${index.works.map((w) => `${w.id} ${w.episodes.length}話`).join(", ")}`);
