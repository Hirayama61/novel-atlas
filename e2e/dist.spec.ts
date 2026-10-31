import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "@playwright/test";
import { FILES } from "../src/core/__tests__/fixtures";
import { REFERENCE_EPISODES } from "./fixture";

/** `pnpm build` の成果物。GitHub Pages にこのまま出る */
const DIST_DIR = join(import.meta.dirname, "..", "dist");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return listFiles(path);
    return [path];
  });
}

/** 本文の 1 行(字下げを除く)。短すぎる行は偶然の一致を避けて使わない */
function toBodyLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^　/, "").trim())
    .filter((l) => l.length >= 8 && !l.startsWith("#"));
}

const BODY_LINES = [
  ...[...FILES]
    .filter(([path]) => path.endsWith("/text.md"))
    .flatMap(([, text]) => toBodyLines(text)),
  ...REFERENCE_EPISODES.flatMap(toBodyLines),
];

test("ビルド成果物にデータリポジトリのファイルと本文が入らない", () => {
  const files = listFiles(DIST_DIR);
  expect(files.length).toBeGreaterThan(0);
  const paths = files.map((f) => relative(DIST_DIR, f));
  expect(paths.filter((p) => p.startsWith("references") || p.startsWith("works"))).toEqual([]);
  expect(paths.filter((p) => /\.(md|ya?ml|csv)$/.test(p))).toEqual([]);

  expect(BODY_LINES.length).toBeGreaterThan(0);
  const leaks = files.flatMap((f) => {
    const content = readFileSync(f, "utf8");
    return BODY_LINES.filter((line) => content.includes(line)).map((line) => `${f}: ${line}`);
  });
  expect(leaks).toEqual([]);
});
