import { describe, expect, it } from "vitest";
import { href, parseHash } from "./router";

describe("読書画面のタブ", () => {
  it("tab=design を設計書タブとして読む", () => {
    expect(parseHash("#/w/lh/e/3?ref=ep%2Flh%2F003&pr=3&tab=design")).toEqual({
      page: "reader",
      work: "lh",
      ep: 3,
      ref: "ep/lh/003",
      pr: 3,
      tab: "design",
    });
  });
  it("tab が無いか設計書以外なら tab を持たない", () => {
    expect(parseHash("#/w/lh/e/3")).not.toHaveProperty("tab");
    expect(parseHash("#/w/lh/e/3?tab=text")).not.toHaveProperty("tab");
  });
  it("設計書タブの指定を URL に書き、指定が無ければ書かない", () => {
    const route = { page: "reader", work: "lh", ep: 3, ref: "main", pr: 3 } as const;
    expect(href({ ...route, tab: "design" })).toBe("#/w/lh/e/3?pr=3&tab=design");
    expect(href(route)).toBe("#/w/lh/e/3?pr=3");
  });
});

describe("参考作品のルート", () => {
  it("話の一覧と読書画面を読む", () => {
    expect(parseHash("#/r/n1111aa")).toEqual({ page: "reference", ncode: "n1111aa" });
    expect(parseHash("#/r/n1111aa/e/3")).toEqual({
      page: "referenceReader",
      ncode: "n1111aa",
      ep: 3,
    });
  });
  it("書いた URL を読み戻すと同じルートになる", () => {
    const routes = [
      { page: "reference", ncode: "n1111aa" },
      { page: "referenceReader", ncode: "n1111aa", ep: 12 },
    ] as const;
    for (const route of routes) expect(parseHash(href(route))).toEqual(route);
  });
});
