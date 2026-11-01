import { describe, expect, it } from "vitest";
import { getEpisodePulls, getTurnItems, getTurnKind, getTurnTab, getTurnTarget } from "../turn";

const pull = (number: number, ref: string, labels: string[]) => ({
  number,
  head: { ref },
  labels: labels.map((name) => ({ name })),
});

describe("あなたの番", () => {
  it.each([
    [["stage:design"], "design-approval"],
    [["stage:design", "design-approved"], undefined],
    [["needs-input"], "needs-input"],
    [["stage:reading"], "reading"],
    [["stage:drafting"], undefined],
    [["stage:revising"], undefined],
    [[], undefined],
  ] as const)("ラベル %j はやること %s", (labels, kind) => {
    expect(getTurnKind(labels)).toBe(kind);
  });

  it("複数当てはまるときは返答 → 設計の承認 → 読む の順で 1 つ選ぶ", () => {
    expect(getTurnKind(["stage:reading", "needs-input"])).toBe("needs-input");
    expect(getTurnKind(["stage:design", "needs-input"])).toBe("needs-input");
  });

  it("ブランチ名から作品と話数を取る", () => {
    expect(getTurnTarget("ep/lh/003")).toEqual({ work: "lh", ep: 3 });
    expect(getTurnTarget("claude/issue-2")).toBeUndefined();
    expect(getTurnTarget("ep/lh/3")).toBeUndefined();
  });

  it("設計段階なら設計書、それ以外は本文を開く", () => {
    expect(getTurnTab(["stage:design", "needs-input"])).toBe("design");
    expect(getTurnTab(["stage:reading"])).toBe("text");
  });

  it("番の PR だけを、やることの順 → PR 番号の順に並べる", () => {
    const items = getTurnItems([
      pull(5, "ep/lh/005", ["stage:reading"]),
      pull(4, "ep/lh/004", ["stage:design"]),
      pull(3, "ep/lh/003", ["stage:reading"]),
      pull(6, "ep/lh/006", ["stage:drafting"]),
      pull(7, "ep/lh/007", ["stage:design", "design-approved"]),
      pull(8, "chore/index", ["stage:reading"]),
    ]);
    expect(items.map((i) => [i.number, i.kind])).toEqual([
      [4, "design-approval"],
      [3, "reading"],
      [5, "reading"],
    ]);
    expect(items[0]).toEqual({
      number: 4,
      ref: "ep/lh/004",
      work: "lh",
      ep: 4,
      kind: "design-approval",
      tab: "design",
    });
  });

  it("該当が無ければ空", () => {
    expect(getTurnItems([pull(6, "ep/lh/006", ["stage:drafting"])])).toEqual([]);
  });
});

describe("話の一覧の進行中の PR", () => {
  const titled = (number: number, ref: string) => ({
    ...pull(number, ref, ["stage:reading"]),
    title: `#${number}`,
  });

  it("その作品の話の PR だけを話数で引く", () => {
    const m = getEpisodePulls(
      [titled(3, "ep/lh/003"), titled(4, "ep/other/001"), titled(5, "claude/issue-2")],
      "lh",
    );
    expect([...m.keys()]).toEqual([3]);
    expect(m.get(3)).toEqual({
      number: 3,
      ref: "ep/lh/003",
      title: "#3",
      labels: ["stage:reading"],
    });
  });

  it("PR が無ければ空", () => {
    expect(getEpisodePulls([], "lh").size).toBe(0);
  });
});
