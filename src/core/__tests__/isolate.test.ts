import { describe, expect, it } from "vitest";
import { buildBundle, extractSection, ROLES } from "../isolate";

const repo = new Map<string, string>([
  ["works/w/episodes/001/text.md", "# 第1話\n　一話。\n"],
  ["works/w/episodes/002/text.md", "# 第2話\n　二話。\n"],
  ["works/w/episodes/003/text.md", "# 第3話\n　三話。\n"],
  ["works/w/episodes/002/design.yaml", "core: 秘密の設計\n"],
  ["works/w/canon/threads.yaml", "threads: []\n"],
  ["works/w/charter.md", "作風憲章\n"],
  [
    "craft/review-checklist.md",
    "# 観点\n\n## A. 整合性\n- 封印を読む\n\n## C. 読者体験\n- C1 面白いか\n\n## D. 下読み\n- D1 判定\n",
  ],
  ["craft/rubric.md", "# ルーブリック\n"],
  ["references/works.csv", "ncode,title\nn0000aa,参考作品の題\n"],
  ["references/n0000aa/meta.json", '{"title":"参考作品の題"}\n'],
  ["references/n0000aa/episodes/001.md", "# 参考の第1話\n　参考作品の本文。\n"],
]);
const read = (p: string) => repo.get(p) ?? null;

describe("隔離バンドル", () => {
  it("本文と許可した節だけが入り、設計・canon・charter は入らない", () => {
    for (const role of ROLES) {
      const b = buildBundle({ work: "w", upto: 2, role, read });
      const keys = [...b.keys()];
      expect(keys.filter((k) => k.startsWith("episodes/"))).toEqual([
        "episodes/001.md",
        "episodes/002.md",
      ]);
      const all = [...b.values()].join("\n");
      expect(all).not.toContain("秘密の設計");
      expect(all).not.toContain("threads");
      expect(all).not.toContain("作風憲章");
      expect(all).not.toContain("封印を読む");
      expect(all).not.toContain("三話");
    }
  });

  it("参考作品の本文と一覧は、どの役割のバンドルにも入らない", () => {
    for (const role of ROLES) {
      const b = buildBundle({ work: "w", upto: 3, role, read });
      const hasReferenceKey = [...b.keys()].some(
        (k) => k.includes("references") || k.includes("n0000aa"),
      );
      expect(hasReferenceKey).toBe(false);
      const all = [...b.values()].join("\n");
      expect(all).not.toContain("参考作品の本文");
      expect(all).not.toContain("参考作品の題");
    }
  });

  it("読者体験には C 節だけ、下読みには D 節だけを渡す", () => {
    const reader = buildBundle({ work: "w", upto: 1, role: "reader", read }).get("checklist.md")!;
    expect(reader).toContain("C1");
    expect(reader).not.toContain("D1");
    const slush = buildBundle({ work: "w", upto: 1, role: "slush", read }).get("checklist.md")!;
    expect(slush).toContain("D1");
    expect(slush).not.toContain("C1");
  });

  it("対象話の本文が無ければ作らない", () => {
    expect(() => buildBundle({ work: "w", upto: 9, role: "reader", read })).toThrow();
  });

  it("節の切り出しは次の同じ深さの見出しで止まる", () => {
    expect(extractSection("## A\na\n### A1\nb\n## B\nc\n", "## A")).toBe("## A\na\n### A1\nb\n");
  });
});
