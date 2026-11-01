/**
 * 「あなたの番」の人がやる Issue: 本体リポジトリの `human` の Issue を並べる。
 *
 * @remarks
 * Issue の取得と開く処理は持たない(`src/ui/hooks/useHumanIssues.ts`)。
 * チェックの更新はしない(GitHub で行う)。
 */

/** 人がやる Issue のラベル(CLAUDE.md のラベル表) */
export const HUMAN_LABEL = "human";

/** チェックリストの項目の行。`- [ ]` `* [x]` `1. [ ]` など。字下げした入れ子も数える */
const TASK_LINE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s/;
/** コードブロックの囲み */
const FENCE = /^\s*(?:```|~~~)/;

export interface TaskCount {
  /** チェックの付いていない項目の数 */
  unchecked: number;
  /** 項目の総数 */
  total: number;
}

export interface HumanIssueItem {
  number: number;
  title: string;
  url: string;
  tasks: TaskCount;
}

interface HumanIssue {
  number: number;
  title: string;
  html_url: string;
  body?: string | null;
  labels: { name: string }[];
  /** あれば PR(Issues API は PR も返す) */
  pull_request?: unknown;
}

/** コードブロックの外にある行だけを返す */
function getLinesOutsideFences(body: string): string[] {
  const lines: string[] = [];
  let isInFence = false;
  for (const line of body.split(/\r?\n/)) {
    const isFence = FENCE.test(line);
    if (isFence) {
      isInFence = !isInFence;
      continue;
    }
    if (!isInFence) lines.push(line);
  }
  return lines;
}

/** 本文のチェックリストの項目を数える。コードブロックの中は数えない */
export function getTaskCount(body: string): TaskCount {
  const marks = getLinesOutsideFences(body)
    .map((line) => TASK_LINE.exec(line))
    .filter((match) => match !== null)
    .map((match) => match[1]);
  const unchecked = marks.filter((mark) => mark === " ").length;
  return { unchecked, total: marks.length };
}

/** 行に出すやること。チェックリストがあれば残りの数、無ければ「対応する」 */
export function getHumanIssueAction(tasks: TaskCount): string {
  const hasTasks = tasks.total > 0;
  if (!hasTasks) return "対応する";
  return `残り ${tasks.unchecked}/${tasks.total}`;
}

/** 人がやる Issue か。PR と、`human` の無いものは除く */
export function isHumanIssue(issue: HumanIssue): boolean {
  const isPull = issue.pull_request !== undefined;
  const hasHumanLabel = issue.labels.some((label) => label.name === HUMAN_LABEL);
  return !isPull && hasHumanLabel;
}

function toHumanIssueItem(issue: HumanIssue): HumanIssueItem {
  const body = issue.body ?? "";
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    tasks: getTaskCount(body),
  };
}

/** open の Issue から人がやるものを選び、番号の順に並べる */
export function getHumanIssueItems(issues: readonly HumanIssue[]): HumanIssueItem[] {
  return issues
    .filter(isHumanIssue)
    .map(toHumanIssueItem)
    .sort((a, b) => a.number - b.number);
}
