// 設計承認のゲート。データリポジトリの Actions が、design-approved の付いた PR への push ごとに呼ぶ。
//   DATA_DIR=... pnpm design-gate <before の SHA> <after の SHA>
// 設計部が変わった design.yaml があれば、そのパスを出して終了コード 1(Actions がラベルを外す)。

import { execFileSync } from "node:child_process";
import { designChanged } from "../src/core/check/gate";
import { requireDataDir } from "./lib/data-dir";

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error("usage: pnpm design-gate <before> <after>");
  process.exit(2);
}
const dir = requireDataDir();
const git = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
const show = (ref: string, path: string) => {
  try {
    return git("show", `${ref}:${path}`);
  } catch {
    return null;
  }
};

const changed = git("diff", "--name-only", before, after)
  .split("\n")
  .filter((p) => /^works\/[^/]+\/episodes\/\d{3}\/design\.yaml$/.test(p));
const broken = changed.filter((p) => designChanged(show(before, p), show(after, p)));
for (const p of broken) console.log(`設計部が変わった: ${p}`);
process.exit(broken.length ? 1 : 0);
