// 隔離バンドル: 隔離レビュアーに渡す物だけを集める。
// 許可リスト方式。ここに書いていないファイルはバンドルに入らない。

import { episodeDir } from "./data/files";

export const ROLES = ["reader", "slush", "scorer", "codex", "codex-scorer"] as const;
export type Role = (typeof ROLES)[number];

/** 役割ごとに渡す craft 文書(パスと、切り出す節の見出しの先頭) */
const CRAFT: Record<Role, { path: string; section?: string; as: string }[]> = {
  reader: [{ path: "craft/review-checklist.md", section: "## C.", as: "checklist.md" }],
  slush: [{ path: "craft/review-checklist.md", section: "## D.", as: "checklist.md" }],
  scorer: [{ path: "craft/rubric.md", as: "rubric.md" }],
  codex: [{ path: "craft/review-checklist.md", section: "## C.", as: "checklist.md" }],
  "codex-scorer": [{ path: "craft/rubric.md", as: "rubric.md" }],
};

/** Markdown から、指定の見出しで始まる節(次の同じ深さの見出しまで)を切り出す */
export function extractSection(md: string, heading: string): string | null {
  const depth = heading.match(/^#+/)?.[0].length ?? 2;
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+)\s/.exec(lines[i]!);
    if (m && m[1]!.length <= depth) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trimEnd() + "\n";
}

export interface BundleInput {
  work: string;
  upto: number;
  role: Role;
  /** データリポジトリのパス → 中身 を引く関数(無ければ null) */
  read: (path: string) => string | null;
}

/** バンドルの中身(バンドル内の相対パス → 中身) */
export function buildBundle({ work, upto, role, read }: BundleInput): Map<string, string> {
  const out = new Map<string, string>();
  for (let n = 1; n <= upto; n++) {
    const text = read(`works/${work}/episodes/${episodeDir(n)}/text.md`);
    if (text !== null) out.set(`episodes/${episodeDir(n)}.md`, text);
  }
  if (!out.has(`episodes/${episodeDir(upto)}.md`)) throw new Error(`第${upto}話の本文が無い`);
  for (const c of CRAFT[role]) {
    const md = read(c.path);
    if (md === null) throw new Error(`${c.path} が無い`);
    const body = c.section ? extractSection(md, c.section) : md;
    if (body === null) throw new Error(`${c.path} に節 ${c.section} が無い`);
    out.set(c.as, body);
  }
  return out;
}
