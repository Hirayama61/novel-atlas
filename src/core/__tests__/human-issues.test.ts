import { describe, expect, it } from "vitest";
import {
  getHumanIssueAction,
  getHumanIssueItems,
  getTaskCount,
  isHumanIssue,
} from "../human-issues";

const issue = (number: number, labels: string[], body: string | null = "", isPull = false) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/o/r/issues/${number}`,
  body,
  labels: labels.map((name) => ({ name })),
  ...(isPull ? { pull_request: {} } : {}),
});

describe("人がやる Issue", () => {
  it.each([
    ["", 0, 0],
    ["- [ ] 一\n- [x] 二\n- [X] 三", 1, 3],
    ["* [ ] 一\n+ [ ] 二\n1. [ ] 三\n2) [x] 四", 3, 4],
    ["- [ ] 一\n  - [ ] 入れ子", 2, 2],
    ["- 普通の項目\n- [] 空\n-[ ] 空白なし\n文中の - [ ] は数えない", 0, 0],
    ["- [ ] 外\n```\n- [ ] 中\n```\n~~~\n- [x] 中\n~~~", 1, 1],
    ["- [ ] 一\r\n- [x] 二\r\n", 1, 2],
  ] as const)("本文 %j は未チェック %d / 全 %d", (body, unchecked, total) => {
    expect(getTaskCount(body)).toEqual({ unchecked, total });
  });

  it("チェックリストがあれば残りの数、無ければ「対応する」", () => {
    expect(getHumanIssueAction({ unchecked: 2, total: 3 })).toBe("残り 2/3");
    expect(getHumanIssueAction({ unchecked: 0, total: 3 })).toBe("残り 0/3");
    expect(getHumanIssueAction({ unchecked: 0, total: 0 })).toBe("対応する");
  });

  it("PR と human の無い Issue は除く", () => {
    expect(isHumanIssue(issue(1, ["human"]))).toBe(true);
    expect(isHumanIssue(issue(2, ["ready"]))).toBe(false);
    expect(isHumanIssue(issue(3, ["human"], "", true))).toBe(false);
  });

  it("人がやる Issue だけを番号の順に並べ、本文が無ければ項目 0 とする", () => {
    const items = getHumanIssueItems([
      issue(9, ["human"], "- [ ] 一"),
      issue(4, ["ready"]),
      issue(5, ["human", "area:app"], null),
    ]);
    expect(items).toEqual([
      {
        number: 5,
        title: "Issue 5",
        url: "https://github.com/o/r/issues/5",
        tasks: { unchecked: 0, total: 0 },
      },
      {
        number: 9,
        title: "Issue 9",
        url: "https://github.com/o/r/issues/9",
        tasks: { unchecked: 1, total: 1 },
      },
    ]);
  });
});
