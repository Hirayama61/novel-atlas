/**
 * 「あなたの番」: 依頼者が手を動かす番の話の PR を選ぶ。
 *
 * @remarks
 * PR の取得と画面遷移は持たない(呼び出し側の UI が持つ)。
 * ラベルの意味は docs/design/05-writing-loop.md のラベル表に従う。
 */

/** 依頼者がやること。並び順はそのまま優先順(1 つの PR に複数当てはまるときは先のもの) */
export const TURN_KINDS = ["needs-input", "design-approval", "reading"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

export const TURN_ACTION_LABELS: Record<TurnKind, string> = {
  "needs-input": "返答する",
  "design-approval": "設計を承認する",
  reading: "読む",
};

/** 話の PR のブランチ名 `ep/<作品>/<NNN>` */
const EPISODE_BRANCH = /^ep\/([^/]+)\/(\d{3})$/;

export interface TurnTarget {
  work: string;
  ep: number;
}

export interface TurnItem {
  number: number;
  ref: string;
  work: string;
  ep: number;
  kind: TurnKind;
  /** 開く画面。設計段階の PR には本文が無いので設計書を開く */
  tab: "text" | "design";
}

/** ラベルが 1 つの判定に当てはまるか */
export function isTurnKind(kind: TurnKind, labels: readonly string[]): boolean {
  const hasDesignStage = labels.includes("stage:design");
  const isDesignApproved = labels.includes("design-approved");
  switch (kind) {
    case "needs-input":
      return labels.includes("needs-input");
    case "design-approval":
      return hasDesignStage && !isDesignApproved;
    case "reading":
      return labels.includes("stage:reading");
  }
}

/** 依頼者がやることを 1 つ選ぶ。番でなければ undefined */
export function getTurnKind(labels: readonly string[]): TurnKind | undefined {
  return TURN_KINDS.find((kind) => isTurnKind(kind, labels));
}

/** ブランチ名から作品と話数を取る。話の PR でなければ undefined */
export function getTurnTarget(ref: string): TurnTarget | undefined {
  const match = EPISODE_BRANCH.exec(ref);
  const isEpisodeBranch = match !== null;
  if (!isEpisodeBranch) return undefined;
  return { work: match[1]!, ep: Number(match[2]) };
}

/** 開く画面。設計段階なら設計書、それ以外は本文 */
export function getTurnTab(labels: readonly string[]): TurnItem["tab"] {
  const isDesignStage = labels.includes("stage:design");
  if (isDesignStage) return "design";
  return "text";
}

interface TurnPull {
  number: number;
  head: { ref: string };
  labels: { name: string }[];
}

function toTurnItem(pull: TurnPull): TurnItem | undefined {
  const labels = pull.labels.map((l) => l.name);
  const kind = getTurnKind(labels);
  const target = getTurnTarget(pull.head.ref);
  const isTurn = kind !== undefined && target !== undefined;
  if (!isTurn) return undefined;
  return { number: pull.number, ref: pull.head.ref, ...target, kind, tab: getTurnTab(labels) };
}

function isTurnItem(item: TurnItem | undefined): item is TurnItem {
  return item !== undefined;
}

function compareTurnItems(a: TurnItem, b: TurnItem): number {
  const byKind = TURN_KINDS.indexOf(a.kind) - TURN_KINDS.indexOf(b.kind);
  const hasDifferentPriority = byKind !== 0;
  if (hasDifferentPriority) return byKind;
  return a.number - b.number;
}

/** open の PR から「あなたの番」を選び、やることの優先順 → PR 番号の順に並べる */
export function getTurnItems(pulls: readonly TurnPull[]): TurnItem[] {
  return pulls.map(toTurnItem).filter(isTurnItem).sort(compareTurnItems);
}

/** 話の一覧で、進行中の話を開くための PR */
export interface EpisodePull {
  number: number;
  ref: string;
  title: string;
  labels: string[];
}

interface EpisodePullSource extends TurnPull {
  title: string;
}

function isPullOfWork(work: string, pull: EpisodePullSource): boolean {
  const target = getTurnTarget(pull.head.ref);
  return target?.work === work;
}

function toEpisodePullEntry(pull: EpisodePullSource): [number, EpisodePull] {
  const target = getTurnTarget(pull.head.ref)!;
  const labels = pull.labels.map((l) => l.name);
  return [target.ep, { number: pull.number, ref: pull.head.ref, title: pull.title, labels }];
}

/**
 * open の PR から、その作品の話ごとの PR を引く。話の PR でないブランチは除く。
 *
 * @remarks
 * PR の取得と画面遷移は持たない(`useEpisodePulls`)。ブランチ名が話を決めるので、1 話に open の PR は 1 本。
 */
export function getEpisodePulls(
  pulls: readonly EpisodePullSource[],
  work: string,
): Map<number, EpisodePull> {
  return new Map(pulls.filter((p) => isPullOfWork(work, p)).map(toEpisodePullEntry));
}
