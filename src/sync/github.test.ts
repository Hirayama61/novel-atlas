import { describe, expect, it } from "vitest";
import { isSyncTarget } from "./github";

describe("isSyncTarget", () => {
  it("参考作品の作品情報・本文・分析を同期する", () => {
    expect(isSyncTarget("references/works.csv")).toBe(true);
    expect(isSyncTarget("references/n1111aa/meta.json")).toBe(true);
    expect(isSyncTarget("references/n1111aa/episodes/001.md")).toBe(true);
    expect(isSyncTarget("references/n1111aa/analysis/notes.md")).toBe(true);
  });
  it("参考作品の取得の記録は同期しない", () => {
    expect(isSyncTarget("references/n1111aa/fetch-state.json")).toBe(false);
    expect(isSyncTarget("references/n1111aa/fetch-log.csv")).toBe(false);
  });
  it("自作の旧版と移行前の散文は同期しない", () => {
    expect(isSyncTarget("works/lh/episodes/001/text.md")).toBe(true);
    expect(isSyncTarget("works/lh/archive/001.md")).toBe(false);
    expect(isSyncTarget("works/lh/legacy/001.md")).toBe(false);
  });
});
