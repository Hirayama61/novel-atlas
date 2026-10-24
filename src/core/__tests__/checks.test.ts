import { describe, expect, it } from "vitest";
import { checkCanon } from "../check/canon";
import { checkDesign } from "../check/design";
import { checkFeedback, lintWork } from "../check/lint";
import { buildDataSet, type Finding } from "../data/work";
import { lintPunctuation, parseVocab } from "../lint/punctuation";
import { DESIGN_3, FILES } from "./fixtures";

const load = (extra: [string, string][] = []) => buildDataSet(new Map([...FILES, ...extra]));
const errors = (fs: Finding[]) => fs.filter((f) => f.level === "error");

describe("スキーマ", () => {
  it("fixture はすべて通る", () => {
    expect(load().findings).toEqual([]);
  });
  it("未知のキーを落とす(綴り違いを見逃さない)", () => {
    const { findings } = load([
      ["works/lh/canon/places.yaml", "places:\n  - { id: x, name: x, status: 確定, nmae: y }\n"],
    ]);
    expect(findings[0]?.check).toBe("schema");
  });
  it("status は確定か仮だけ", () => {
    const { findings } = load([
      ["works/lh/canon/places.yaml", "places:\n  - { id: x, name: x, status: 決定 }\n"],
    ]);
    expect(findings).toHaveLength(1);
  });
});

describe("canon 照合", () => {
  it("fixture にはエラーが無い", () => {
    const { data } = load();
    expect(errors(checkCanon(data.works.get("lh")!))).toEqual([]);
  });
  it("出典の引用が本文から消えたら落とす", () => {
    const { data } = load([["works/lh/episodes/001/text.md", "# 第1話\n　灯室の窓が割れた。\n"]]);
    const fs = errors(checkCanon(data.works.get("lh")!));
    expect(fs.some((f) => f.check === "出典")).toBe(true);
  });
  it("回収前の封印語を落とす", () => {
    const { data } = load([["works/lh/episodes/002/text.md", "# 第2話\n　母の手紙が出てきた。\n"]]);
    const fs = errors(checkCanon(data.works.get("lh")!));
    expect(fs).toEqual([expect.objectContaining({ check: "封印語", line: 2 })]);
  });
  it("避ける表記を落とす", () => {
    const { data } = load([["works/lh/episodes/002/text.md", "# 第2話\n　航海日誌を開いた。\n"]]);
    expect(errors(checkCanon(data.works.get("lh")!))[0]?.check).toBe("表記");
  });
  it("避ける表記は正規表現で、別の語の一部は外せる", () => {
    const { data } = load([
      ["works/lh/canon/rules.yaml", "lexicon:\n  - { prefer: 手帳, avoid: ['(?<!几)帳面'] }\n"],
      ["works/lh/episodes/002/text.md", "# 第2話\n　几帳面な男。\n　帳面を開く。\n"],
    ]);
    const fs = errors(checkCanon(data.works.get("lh")!)).filter((f) => f.check === "表記");
    expect(fs.map((f) => f.line)).toEqual([3]);
  });
  it("未登録の ID への参照を落とす", () => {
    const { data } = load([
      [
        "works/lh/canon/characters/x.yaml",
        "id: x\nname: X\nstatus: 確定\nrelations: [{ to: nobody, kind: 親子, status: 確定 }]\n",
      ],
    ]);
    expect(errors(checkCanon(data.works.get("lh")!))[0]?.check).toBe("参照");
  });
});

describe("話設計書", () => {
  const design = (yaml: string) => {
    const { data, findings } = load([["works/lh/episodes/003/design.yaml", yaml]]);
    expect(findings).toEqual([]);
    const w = data.works.get("lh")!;
    return checkDesign(w, w.episodes.get(3)!.design!);
  };
  it("正しい設計書はエラーが無い", () => {
    expect(errors(design(DESIGN_3))).toEqual([]);
  });
  it("テクスチャが 1 件なら落とす", () => {
    const y = DESIGN_3.replace("  - { kind: 気候, element: 塩の雨, scene: s2 }\n", "");
    expect(errors(design(y)).map((f) => f.check)).toContain("テクスチャ");
  });
  it("場面に出るのに cast に無いキャラを落とす", () => {
    const y = DESIGN_3.replace(
      "  - { who: father, desire: 灯を守る, action: 黙る, new_facet: 歌う }\n",
      "",
    );
    expect(errors(design(y)).map((f) => f.check)).toContain("キャスト");
  });
  it("知る前の事実を前提にする場面を落とす", () => {
    const y = DESIGN_3.replace("fact: lh.blind", "fact: lh.letter");
    expect(errors(design(y)).map((f) => f.check)).toContain("知識");
  });
  it("不発条件の発話を発動扱いにしたら落とす", () => {
    const y = DESIGN_3.replace("kind: 断言, expect_fire: true", "kind: 願望, expect_fire: true");
    expect(errors(design(y)).map((f) => f.check)).toContain("異能");
  });
  it("この話向けの未消化の申し送りを扱っていなければ落とす", () => {
    const y = DESIGN_3.replace(
      "handoff_in: [{ id: H-3-01, action: consume, how: s1 }]",
      "handoff_in: []",
    );
    expect(errors(design(y)).map((f) => f.check)).toContain("申し送り");
  });
  it("字数の合計が予算とずれたら落とす", () => {
    const y = DESIGN_3.replace("total: 100", "total: 300");
    expect(errors(design(y)).map((f) => f.check)).toContain("字数");
  });
  it("未撒きの伏線の回収を落とす", () => {
    const y = DESIGN_3.replace("payoff: [], keep: [F1]", "payoff: [{ id: F1 }], keep: []");
    expect(errors(design(y)).map((f) => f.check)).toContain("伏線");
  });
});

describe("句読点 lint(旧 check.pl の移植)", () => {
  const vocab = parseVocab("# コメント\n(?<!釣り)銭\t金\t2026-07-17\n辻\t十字路\t口頭で使わない\n");
  it("読点で終わる行・断片終止・要注意語を拾う", () => {
    const hits = lintPunctuation(
      "　雨が、\n　ごぼ、と。\n　銭を払った。釣り銭はいらない。\n　辻に立つ。\n",
      vocab,
    );
    expect(hits.map((h) => `${h.kind}:${h.line}`)).toEqual([
      "S4:1",
      "FRAG:2",
      "VOCAB:3",
      "VOCAB:4",
    ]);
  });
  it("読点 2 つ以上の文は文単位で数える(1 行に複数文があっても)", () => {
    const hits = lintPunctuation("　ああ、そう、か。うん、うん。\n", vocab);
    expect(hits.filter((h) => h.kind === "C2")).toHaveLength(1);
  });
  it("lint-allow に理由つきで書いた行は落とさない", () => {
    const { data } = load([
      ["works/lh/episodes/002/text.md", "# 第2話\n　ごぼ、と。\n"],
      [
        "works/lh/episodes/002/lint-allow.yaml",
        "allow:\n  - { rule: FRAG, quote: ごぼ、と, reason: 擬音の溜め }\n",
      ],
    ]);
    const input = { data, workVocab: new Map<string, string>() };
    expect(lintWork(data.works.get("lh")!, input)).toEqual([]);
  });
});

describe("feedback", () => {
  it("vocab に分類したのに辞書に行が無ければ落とす", () => {
    const fb = `episode: 2
pr: 1
rounds: 1
items:
  - { id: fb.002.1, source: owner, round: 1, body: 辻は伝わらない, tags: [vocab], decision: 採用, vocab_pattern: 辻 }
`;
    const { data } = load([["works/lh/feedback/002.yaml", fb]]);
    const w = data.works.get("lh")!;
    expect(checkFeedback(w, { data, workVocab: new Map() })).toHaveLength(1);
    expect(checkFeedback(w, { data, workVocab: new Map([["lh", "辻\t十字路\t\n"]]) })).toEqual([]);
  });
});
