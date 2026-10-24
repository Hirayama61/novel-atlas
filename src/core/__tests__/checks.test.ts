import { describe, expect, it } from "vitest";
import { checkCanon } from "../check/canon";
import { checkClaims } from "../check/claims";
import { designChanged } from "../check/gate";
import { checkDesign } from "../check/design";
import { checkFeedback, checkLength, lintWork } from "../check/lint";
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

describe("claims", () => {
  const sha = (t: string) => `sha:${t.length}`;
  const base = (claims: string, status = "drafting") =>
    load([
      [
        "works/lh/episodes/003/design.yaml",
        DESIGN_3.replace("status: designing", `status: ${status}`),
      ],
      [
        "works/lh/episodes/003/text.md",
        "# 第3話\n「潮は今夜引く」\n　父さんには灯は見えてない。\n",
      ],
      ...(claims ? ([["works/lh/episodes/003/claims.yaml", claims]] as [string, string][]) : []),
    ]);
  const ok = `text_sha: "sha:${"# 第3話\n「潮は今夜引く」\n　父さんには灯は見えてない。\n".length}"
extractor: { model: m, prompt_version: 1 }
speakers: [{ line: 2, who: mio }]
names: [{ quote: 父さん, resolves_to: father }]
knowledge_use: [{ who: mio, fact: lh.blind, quote: 父さんには灯は見えてない }]
ability_use: [{ who: mio, quote: 潮は今夜引く, kind: 断言, fired: true, drift: 時機 }]
`;
  it("正しい claims はエラーが無い", () => {
    const { data, findings } = base(ok);
    expect(findings).toEqual([]);
    expect(errors(checkClaims(data.works.get("lh")!, sha))).toEqual([]);
  });
  it("本文があるのに claims が無ければ落とす(投稿済みの話は除く)", () => {
    expect(errors(checkClaims(base("").data.works.get("lh")!, sha))).toHaveLength(1);
    expect(errors(checkClaims(base("", "published").data.works.get("lh")!, sha))).toEqual([]);
  });
  it("本文が変わったのに抽出し直していなければ落とす", () => {
    const { data } = base(ok.replace(/text_sha: "[^"]+"/, 'text_sha: "old"'));
    expect(errors(checkClaims(data.works.get("lh")!, sha))[0]?.check).toBe("claims の鮮度");
  });
  it("本文に無い引用(抽出の幻覚)を落とす", () => {
    const { data } = base(ok.replace("quote: 父さん,", "quote: 母さん,"));
    expect(errors(checkClaims(data.works.get("lh")!, sha))[0]?.check).toBe("claims の引用");
  });
  it("不発条件の発話が発動していたら落とす", () => {
    const { data } = base(ok.replace("kind: 断言, fired: true", "kind: 願望, fired: true"));
    expect(errors(checkClaims(data.works.get("lh")!, sha))[0]?.check).toBe("異能");
  });
  it("話者が使わない語を落とす", () => {
    const { data } = load([
      [
        "works/lh/episodes/003/design.yaml",
        DESIGN_3.replace("status: designing", "status: drafting"),
      ],
      [
        "works/lh/episodes/003/text.md",
        "# 第3話\n「潮は今夜引く」\n　父さんには灯は見えてない。\n",
      ],
      ["works/lh/episodes/003/claims.yaml", ok],
      [
        "works/lh/canon/characters/mio.yaml",
        "id: mio\nname: ミオ\nstatus: 確定\nvoice: { avoid: [{ pattern: '今夜' }] }\nknowledge:\n  - { fact: lh.blind, from: 2, status: 確定 }\n",
      ],
    ]);
    expect(errors(checkClaims(data.works.get("lh")!, sha)).map((f) => f.check)).toEqual(["口調"]);
  });
});

describe("設計承認のゲート", () => {
  it("場面の beats・drift・題名の変更は通し、それ以外の設計部の変更を捕まえる", () => {
    expect(
      designChanged(
        DESIGN_3,
        DESIGN_3.replace("beats: [父が灯を点けない]", "beats: [父は灯を点けなかった]"),
      ),
    ).toBe(false);
    expect(designChanged(DESIGN_3, DESIGN_3.replace("final: null", "final: 灯を消す"))).toBe(false);
    expect(designChanged(DESIGN_3, DESIGN_3.replace("drift: 規模", "drift: 時機"))).toBe(false);
    expect(
      designChanged(DESIGN_3, DESIGN_3.replace("core: 娘が灯を消す", "core: 娘が灯を守る")),
    ).toBe(true);
    expect(
      designChanged(DESIGN_3, DESIGN_3.replace("characters: [mio]", "characters: [mio, father]")),
    ).toBe(true);
  });
});

describe("版と字数", () => {
  it("旧版(archive/)の本文と設定は読み込まない", () => {
    const { data, findings } = load([
      ["works/lh/archive/editions/v1/episodes/001/text.md", "# 第1話\n　旧版。\n"],
      ["works/lh/archive/editions/v1/canon/places.yaml", "places: [{ id: x }]\n"],
    ]);
    expect(findings).toEqual([]);
    expect(data.works.get("lh")!.episodes.get(1)!.text).not.toContain("旧版");
  });
  it("本文の字数が上限を超えたら落とす", () => {
    const long = `# 第2話\n　${"あ".repeat(121)}\n`;
    const { data } = load([["works/lh/episodes/002/text.md", long]]);
    expect(checkLength(data.works.get("lh")!).map((f) => f.check)).toEqual(["字数"]);
    expect(checkLength(load().data.works.get("lh")!)).toEqual([]);
  });
  it("字数予算が上限を超えたら落とす", () => {
    const y = DESIGN_3.replace("total: 100", "total: 130").replace(
      "target_chars: 50",
      "target_chars: 80",
    );
    const { data } = load([["works/lh/episodes/003/design.yaml", y]]);
    const w = data.works.get("lh")!;
    expect(errors(checkDesign(w, w.episodes.get(3)!.design!)).map((f) => f.check)).toContain(
      "字数",
    );
  });
  it("本文で成り立つ事実は、現行版の出典が付くまで確定にできない", () => {
    const place = (extra: string) =>
      load([
        [
          "works/lh/canon/places.yaml",
          `places:\n  - { id: lighthouse, name: 灯台, status: 確定, basis: 本文${extra} }\n`,
        ],
      ]);
    const fs = (extra: string) =>
      errors(checkCanon(place(extra).data.works.get("lh")!)).map((f) => f.check);
    expect(fs("")).toContain("確定の根拠");
    expect(fs(", sources: [{ ep: 1, quote: 灯室の窓が赤く割れた }]")).not.toContain("確定の根拠");
  });
});
