import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { LintInput } from "../../src/core/check/lint";
import { buildDataSet } from "../../src/core/data/work";

const SKIP = new Set([".git", "node_modules", "references"]);

/** DATA_DIR 以下の YAML・本文・辞書を読む(references/ の本文キャッシュは読まない) */
export function readDataDir(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ya?ml|md|tsv)$/.test(name))
        files.set(relative(dir, p).split(sep).join("/"), readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return files;
}

export function loadDataDir(dir: string) {
  const files = readDataDir(dir);
  const { data, findings } = buildDataSet(files);
  const workVocab = new Map<string, string>();
  for (const [p, c] of files) {
    const m = /^works\/([^/]+)\/lint\/vocab\.tsv$/.exec(p);
    if (m) workVocab.set(m[1]!, c);
  }
  const lint: LintInput = { data, commonVocab: files.get("craft/lint/vocab.tsv"), workVocab };
  return { files, data, findings, lint };
}

export function requireDataDir(): string {
  const dir = process.env.DATA_DIR;
  if (!dir) {
    console.error("DATA_DIR(novel-atlas-data の clone)を指定してください");
    process.exit(2);
  }
  return dir;
}
