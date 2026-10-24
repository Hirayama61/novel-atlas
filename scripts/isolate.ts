// 隔離バンドルを作る。隔離レビュアー(読者体験・下読み・採点・Codex)はこのディレクトリだけを見て動く。
//   DATA_DIR=... pnpm isolate --work hoshiyomi --upto 7 --role reader --out /tmp/bundle
// --ref を渡すと、DATA_DIR の作業ツリーでなく git のその ref から読む(PR のブランチを読むとき)。
// 出力先は空であること(古いバンドルの残りを混ぜない)。

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildBundle, ROLES, type Role } from "../src/core/isolate";
import { requireDataDir } from "./lib/data-dir";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const work = opt("work");
const upto = Number(opt("upto"));
const role = opt("role") as Role;
const out = opt("out");
const ref = opt("ref");
if (!work || !upto || !out || !ROLES.includes(role)) {
  console.error(
    `usage: pnpm isolate --work <id> --upto <N> --role <${ROLES.join("|")}> --out <dir> [--ref <git ref>]`,
  );
  process.exit(2);
}
const dir = requireDataDir();

const read = (path: string): string | null => {
  if (ref) {
    try {
      return execFileSync("git", ["-C", dir, "show", `${ref}:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return null;
    }
  }
  const p = join(dir, path);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

if (existsSync(out) && readdirSync(out).length > 0) {
  console.error(`${out} が空ではありません`);
  process.exit(2);
}
const bundle = buildBundle({ work, upto, role, read });
for (const [rel, content] of bundle) {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}
console.log(`${out}: ${bundle.size} ファイル (${[...bundle.keys()].join(", ")})`);
