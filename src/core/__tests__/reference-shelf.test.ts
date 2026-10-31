import { describe, expect, it } from "vitest";
import { getNextEpisode, getReferenceEpisodePath, getReferenceShelf } from "../reference-shelf";

describe("getReferenceShelf", () => {
  it("本文のある作品だけを ncode 順に並べ、話を番号順にする", () => {
    const files = new Map([
      ["references/n2222bb/episodes/002.md", "二"],
      ["references/n2222bb/episodes/010.md", "十"],
      ["references/n2222bb/episodes/001.md", "一"],
      ["references/n1111aa/episodes/001.md", "一"],
      ["references/n3333cc/meta.json", '{"title":"本文の無い作品"}'],
      ["references/n1111aa/analysis/notes.md", "分析"],
    ]);
    expect(getReferenceShelf(files)).toEqual([
      { ncode: "n1111aa", title: "n1111aa", episodes: [1] },
      { ncode: "n2222bb", title: "n2222bb", episodes: [1, 2, 10] },
    ]);
  });

  it("題名は一覧を先に、meta.json を後に見る", () => {
    const files = new Map([
      ["references/works.csv", "ncode,title,volumes,note\nn1111aa,一覧の題,,\nn2222bb,,,\n"],
      ["references/n1111aa/meta.json", '{"title":"meta の題"}'],
      ["references/n1111aa/episodes/001.md", "一"],
      ["references/n2222bb/meta.json", '{"title":"meta の題"}'],
      ["references/n2222bb/episodes/001.md", "一"],
    ]);
    expect(getReferenceShelf(files).map((w) => w.title)).toEqual(["一覧の題", "meta の題"]);
  });

  it("meta.json が読めないか題名が無ければ ncode を題にする", () => {
    const files = new Map([
      ["references/n1111aa/meta.json", "{壊れた"],
      ["references/n1111aa/episodes/001.md", "一"],
      ["references/n2222bb/meta.json", '{"title":1}'],
      ["references/n2222bb/episodes/001.md", "一"],
    ]);
    expect(getReferenceShelf(files).map((w) => w.title)).toEqual(["n1111aa", "n2222bb"]);
  });
});

describe("getReferenceEpisodePath", () => {
  it("話番号を 3 桁にゼロ詰めする", () => {
    expect(getReferenceEpisodePath("n1111aa", 7)).toBe("references/n1111aa/episodes/007.md");
  });
});

describe("getNextEpisode", () => {
  it("番号が飛んでいても次にある話を返す", () => {
    expect(getNextEpisode([1, 2, 5], 2)).toBe(5);
  });
  it("最後の話なら null", () => {
    expect(getNextEpisode([1, 2, 5], 5)).toBeNull();
  });
});
