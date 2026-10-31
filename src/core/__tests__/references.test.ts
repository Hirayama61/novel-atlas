import { describe, expect, it } from "vitest";
import { addReference, parseNcode, parseReferencesCsv, removeReference } from "../references";

describe("登録の入力から ncode を取り出す", () => {
  it.each([
    ["n1234ab", "n1234ab"],
    ["  N1234AB ", "n1234ab"],
    ["https://ncode.syosetu.com/n1234ab/", "n1234ab"],
    ["https://ncode.syosetu.com/n1234ab/12/", "n1234ab"],
    ["ncode.syosetu.com/n9876z", "n9876z"],
  ])("%s は %s", (input, ncode) => {
    expect(parseNcode(input)).toEqual({ kind: "ok", ncode });
  });

  it.each([
    ["", "URL か ncode を入れてください"],
    ["https://novel18.syosetu.com/n1234ab/", "年齢制限のある作品は登録できません"],
    [
      "https://kakuyomu.jp/works/1177354054",
      "小説家になろう(ncode.syosetu.com)の URL だけ登録できます",
    ],
    ["https://ncode.syosetu.com/novelview/", "URL に作品の ncode が見つかりません"],
    ["灯台守の娘", "小説家になろう(ncode.syosetu.com)の URL だけ登録できます"],
  ])("%s は受け付けない", (input, reason) => {
    expect(parseNcode(input)).toEqual({ kind: "error", reason });
  });
});

describe("参考作品の一覧", () => {
  const CSV =
    'ncode,title,volumes,note\nn1111aa,"灯台の夜, 前編",2,\nn2222bb,潮見,,"注記に""引用"""\n';

  it("見出しを飛ばし、引用符と区切りを読む", () => {
    expect(parseReferencesCsv(CSV)).toEqual([
      { ncode: "n1111aa", title: "灯台の夜, 前編", volumes: "2", note: "" },
      { ncode: "n2222bb", title: "潮見", volumes: "", note: '注記に"引用"' },
    ]);
  });

  it("ファイルが無ければ見出しから作って 1 行足す", () => {
    expect(addReference(null, "n1234ab")).toEqual({
      kind: "ok",
      text: "ncode,title,volumes,note\nn1234ab,,,\n",
    });
  });

  it("既存の行を書き換えずに末尾へ足す", () => {
    const result = addReference(CSV.trimEnd(), "n3333cc");
    expect(result).toEqual({ kind: "ok", text: `${CSV}n3333cc,,,\n` });
  });

  it("同じ ncode は二度足さない", () => {
    expect(addReference(CSV, "n2222bb")).toEqual({
      kind: "error",
      reason: "n2222bb は登録済みです",
    });
  });

  it("行を外し、ほかの行は元のまま残す", () => {
    expect(removeReference(CSV, "n1111aa")).toEqual({
      kind: "ok",
      text: 'ncode,title,volumes,note\nn2222bb,潮見,,"注記に""引用"""\n',
    });
  });

  it("一覧に無い ncode は外せない", () => {
    expect(removeReference(CSV, "n9999zz")).toEqual({
      kind: "error",
      reason: "n9999zz は一覧にありません",
    });
  });
});
