import { describe, expect, it } from "vitest";
import {
  buildCommentBody,
  commentText,
  isBotComment,
  parseCommentMeta,
  BOT_MARK,
} from "../comment";
import { buildIndex, titleFromText } from "../index-file";
import { buildDataSet } from "../data/work";
import { postingStats, toPostingText } from "../posting";
import { parseRuby, stripRuby } from "../ruby";
import { FILES, TEXT_1 } from "./fixtures";

describe("ルビ", () => {
  it("縦棒で親文字を明示する", () => {
    expect(parseRuby("｜灯台守《とうだいもり》の娘")).toEqual([
      { kind: "ruby", base: "灯台守", ruby: "とうだいもり" },
      { kind: "text", text: "の娘" },
    ]);
  });
  it("漢字の直後のルビは漢字の連なりだけを親文字にする", () => {
    expect(parseRuby("あの灯室《とうしつ》へ")).toEqual([
      { kind: "text", text: "あの" },
      { kind: "ruby", base: "灯室", ruby: "とうしつ" },
      { kind: "text", text: "へ" },
    ]);
  });
  it("傍点", () => {
    expect(parseRuby("《《本当に》》")).toEqual([{ kind: "emphasis", text: "本当に" }]);
  });
  it("丸括弧はルビにしない", () => {
    expect(parseRuby("（第1話 了）")).toEqual([{ kind: "text", text: "（第1話 了）" }]);
  });
  it("漢字の無い《》はそのまま残す", () => {
    expect(stripRuby("あ《い》")).toBe("あ《い》");
  });
});

describe("投稿用の本文", () => {
  it("見出し・了行・行頭の全角空白を外す", () => {
    const p = toPostingText(TEXT_1);
    expect(p.startsWith("灯室の窓が赤く割れた。\n")).toBe(true);
    expect(p).not.toContain("# ");
    expect(p).not.toContain("了）");
    expect(p).toContain("「潮は今夜引く」\nミオは言い切った。");
    expect(postingStats(TEXT_1).last).toBe("ミオは言い切った。");
  });
});

describe("コメント本文", () => {
  it("引用と隠し印を付け、読み戻せる", () => {
    const b = buildCommentBody("きつすぎる", "父さんには\n灯は見えてない", {
      ep: 7,
      lines: [3, 4],
      blob: "abc",
    });
    expect(parseCommentMeta(b)).toEqual({ ep: 7, lines: [3, 4], blob: "abc" });
    expect(commentText(b)).toBe("きつすぎる");
    expect(isBotComment(b)).toBe(false);
    expect(isBotComment(`採用しました\n${BOT_MARK}`)).toBe(true);
  });
});

describe("index.json", () => {
  it("作品と話の一覧を作る", () => {
    const { data } = buildDataSet(new Map(FILES));
    const idx = buildIndex(data, new Date("2026-01-01T00:00:00Z"));
    expect(idx.works[0]?.episodes.map((e) => [e.no, e.title])).toEqual([
      [1, "灯台の夜"],
      [2, "港へ"],
    ]);
    expect(titleFromText("# 第12話 嵐")).toBe("嵐");
  });
});
