// references/works.csv の作品の未取得の話を取り、データリポジトリの references/ に書く。

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseNcode, parseReferencesCsv, REFERENCES_CSV_PATH } from "../../src/core/references";
import { extractEpisodeText, getEpisodePath, getEpisodeUrl } from "./episode-html";
import { getNovelMetaUrl, parseNovelMeta } from "./novel-api";
import type { Clock, PoliteClient } from "./polite-client";

/** 収集の進捗のパス(docs/design/01-data-repo.md) */
export const FETCH_STATE_PATH = "references/fetch-state.json";

/** 取得失敗の記録の見出し行 */
const FETCH_LOG_HEADER = "日時,話,理由";

/** 作品全体の失敗を記録するときの「話」の欄 */
const WHOLE_WORK = "作品";

/** 話が消えている(削除・非公開)ことを表す HTTP の状態 */
const GONE_STATUSES = [404, 410];

/** 取得元が「待て」と言っている HTTP の状態。この回の収集を止める */
const BACK_OFF_STATUSES = [429, 503];

export type WorkStatus = "完了" | "途中" | "失敗" | "未着手";

export interface WorkState {
  status: WorkStatus;
  /** API の話数。作品情報を取れなかったときは前回の値か `null` */
  episodes: number | null;
  /** 置いてある話の数 */
  fetched: number;
  /** 消えた(404/410 を返した)話の番号。次の回からは取りに行かない */
  gone: number[];
  /** 失敗の理由。失敗していなければ持たない */
  reason?: string;
}

/** 前回の進捗に消えた話の欄が無いとき(欄を足す前の `fetch-state.json`) */
const NO_GONE: number[] = [];

export interface CollectSummary {
  /** この回に取った話の数 */
  fetched: number;
  /** 打ち切った理由。最後まで回ったら `null` */
  stoppedBy: string | null;
  works: Record<string, WorkState>;
}

/** この回の打ち切りの条件 */
export interface Budget {
  /** この回に取る話の上限 */
  maxEpisodes: number;
  /** この時刻(ミリ秒)を過ぎたら新しいリクエストを送らない */
  deadline: number;
}

type WorkOutcome =
  { kind: "done"; state: WorkState } | { kind: "stop"; state: WorkState; reason: string };

/**
 * 一覧の作品を上から順に取る。失敗した作品は理由を `fetch-log.csv` に残して次へ進む。
 *
 * @remarks
 * 既に置いてある話は取り直さない。作品情報(`meta.json`)は毎回取り直す。
 * 間隔は `client` が守る。打ち切りは `budget` で決める。git の操作はしない(スキルが行う)。
 */
export async function collectReferences(
  dataDir: string,
  budget: Budget,
  client: PoliteClient,
  clock: Clock,
): Promise<CollectSummary> {
  const works = readWorks(dataDir);
  const previous = readFetchState(dataDir);
  const summary: CollectSummary = { fetched: 0, stoppedBy: null, works: {} };
  for (const work of works) {
    const ncode = work.ncode;
    const prev = previous[ncode];
    const prevEpisodes = prev?.episodes ?? null;
    const prevGone = prev?.gone ?? NO_GONE;
    if (summary.stoppedBy !== null) {
      summary.works[ncode] = pendingState(dataDir, ncode, prevEpisodes, prevGone);
      continue;
    }
    const known = { episodes: prevEpisodes, gone: prevGone };
    const outcome = await collectWork(dataDir, ncode, known, budget, client, clock, summary);
    summary.works[ncode] = outcome.state;
    if (outcome.kind === "stop") summary.stoppedBy = outcome.reason;
  }
  writeFetchState(dataDir, summary.works, clock.now());
  return summary;
}

function readWorks(dataDir: string) {
  const csvPath = join(dataDir, REFERENCES_CSV_PATH);
  const hasCsv = existsSync(csvPath);
  if (!hasCsv) return [];
  return parseReferencesCsv(readFileSync(csvPath, "utf8"));
}

async function collectWork(
  dataDir: string,
  rawNcode: string,
  known: { episodes: number | null; gone: number[] },
  budget: Budget,
  client: PoliteClient,
  clock: Clock,
  summary: CollectSummary,
): Promise<WorkOutcome> {
  const prevEpisodes = known.episodes;
  const gone = [...known.gone];
  const parsed = parseNcode(rawNcode);
  if (parsed.kind === "error") {
    const state = failWork(dataDir, rawNcode, prevEpisodes, gone, parsed.reason, clock);
    return { kind: "done", state };
  }
  const ncode = parsed.ncode;
  const stopReason = getStopReason(budget, summary.fetched, clock.now());
  if (stopReason !== null)
    return {
      kind: "stop",
      state: pendingState(dataDir, ncode, prevEpisodes, gone),
      reason: stopReason,
    };
  try {
    const metaRes = await client.get(getNovelMetaUrl(ncode));
    if (metaRes.kind === "http-error") {
      const reason = `作品情報の取得で HTTP ${metaRes.status}`;
      const state = failWork(dataDir, ncode, prevEpisodes, gone, reason, clock);
      return toOutcome(state, metaRes.status, reason);
    }
    const meta = parseNovelMeta(metaRes.body);
    if (meta.kind === "error")
      return {
        kind: "done",
        state: failWork(dataDir, ncode, prevEpisodes, gone, meta.reason, clock),
      };
    writeText(dataDir, `references/${ncode}/meta.json`, `${JSON.stringify(meta.meta, null, 2)}\n`);
    const missing = getMissingEpisodes(dataDir, ncode, meta.episodeCount);
    const toFetch = getEpisodesToFetch(missing, gone);
    for (const episode of toFetch) {
      const stop = getStopReason(budget, summary.fetched, clock.now());
      if (stop !== null) {
        const state = workState(dataDir, ncode, meta.episodeCount, gone);
        return { kind: "stop", state, reason: stop };
      }
      const url = getEpisodeUrl(ncode, episode, meta.isShortStory);
      const res = await client.get(url);
      if (res.kind === "http-error") {
        const reason = `HTTP ${res.status}`;
        const isGone = GONE_STATUSES.includes(res.status);
        if (isGone) {
          appendFetchLog(dataDir, ncode, String(episode), `${reason}(削除・非公開。飛ばす)`, clock);
          gone.push(episode);
          continue;
        }
        const count = meta.episodeCount;
        const state = failWork(dataDir, ncode, count, gone, reason, clock, String(episode));
        return toOutcome(state, res.status, reason);
      }
      const text = extractEpisodeText(res.body);
      if (text === null) {
        const reason = "本文が見つかりません(ページの作りが変わった可能性)";
        const count = meta.episodeCount;
        const state = failWork(dataDir, ncode, count, gone, reason, clock, String(episode));
        return { kind: "done", state };
      }
      writeText(dataDir, getEpisodePath(ncode, episode), text);
      summary.fetched++;
    }
    return { kind: "done", state: workState(dataDir, ncode, meta.episodeCount, gone) };
  } catch (error) {
    const reason = `通信の失敗: ${toMessage(error)}`;
    return { kind: "done", state: failWork(dataDir, ncode, prevEpisodes, gone, reason, clock) };
  }
}

/** 取得元が待てと言っていたら、この回を止める */
function toOutcome(state: WorkState, status: number, reason: string): WorkOutcome {
  const isBackOff = BACK_OFF_STATUSES.includes(status);
  if (isBackOff) return { kind: "stop", state, reason: `取得元が ${reason} を返した` };
  return { kind: "done", state };
}

/** 上限か締め切りに達していたら理由を返す */
export function getStopReason(budget: Budget, fetched: number, now: number): string | null {
  const isFull = fetched >= budget.maxEpisodes;
  if (isFull) return `話数の上限(${budget.maxEpisodes} 話)に達した`;
  const isLate = now >= budget.deadline;
  if (isLate) return "時間の上限に達した";
  return null;
}

/** 1 から `count` までのうち、まだ置いていない話の番号 */
export function getMissingEpisodes(dataDir: string, ncode: string, count: number): number[] {
  const all = Array.from({ length: count }, (_v, i) => i + 1);
  return all.filter((episode) => !existsSync(join(dataDir, getEpisodePath(ncode, episode))));
}

/** 置いていない話のうち、消えたと分かっている話を除いたもの(取りに行く話) */
export function getEpisodesToFetch(missing: number[], gone: number[]): number[] {
  return missing.filter((episode) => !gone.includes(episode));
}

/**
 * 消えた話のうち、まだ置いていないものだけを残す。
 *
 * @remarks
 * 話数が減って範囲の外になった番号と、後から本文を置いた番号は `missing` に無いので落ちる。
 */
export function getCurrentGone(gone: number[], missing: number[]): number[] {
  return gone.filter((episode) => missing.includes(episode));
}

function countFetched(dataDir: string, ncode: string, count: number | null): number {
  if (count === null) return 0;
  return count - getMissingEpisodes(dataDir, ncode, count).length;
}

/** 話数が分かっていれば範囲と置いた話で絞る。分からなければ前回のまま持ち越す */
function keepGone(dataDir: string, ncode: string, count: number | null, gone: number[]): number[] {
  if (count === null) return gone;
  return getCurrentGone(gone, getMissingEpisodes(dataDir, ncode, count));
}

/** 消えた話を除いて全部置いてあれば完了 */
function workState(dataDir: string, ncode: string, count: number, gone: number[]): WorkState {
  const missing = getMissingEpisodes(dataDir, ncode, count);
  const currentGone = getCurrentGone(gone, missing);
  const fetched = count - missing.length;
  const isComplete = getEpisodesToFetch(missing, currentGone).length === 0;
  if (isComplete) return { status: "完了", episodes: count, fetched, gone: currentGone };
  return { status: "途中", episodes: count, fetched, gone: currentGone };
}

function pendingState(
  dataDir: string,
  ncode: string,
  count: number | null,
  gone: number[],
): WorkState {
  const fetched = countFetched(dataDir, ncode, count);
  return {
    status: "未着手",
    episodes: count,
    fetched,
    gone: keepGone(dataDir, ncode, count, gone),
  };
}

function failWork(
  dataDir: string,
  ncode: string,
  count: number | null,
  gone: number[],
  reason: string,
  clock: Clock,
  episode = WHOLE_WORK,
): WorkState {
  const isValidDir = parseNcode(ncode).kind === "ok";
  if (isValidDir) appendFetchLog(dataDir, ncode, episode, reason, clock);
  const fetched = countFetched(dataDir, ncode, count);
  return {
    status: "失敗",
    episodes: count,
    fetched,
    gone: keepGone(dataDir, ncode, count, gone),
    reason,
  };
}

function appendFetchLog(
  dataDir: string,
  ncode: string,
  episode: string,
  reason: string,
  clock: Clock,
): void {
  const path = join(dataDir, `references/${ncode}/fetch-log.csv`);
  mkdirSync(dirname(path), { recursive: true });
  const isNew = !existsSync(path);
  if (isNew) writeFileSync(path, `${FETCH_LOG_HEADER}\n`);
  const line = [new Date(clock.now()).toISOString(), episode, reason].map(quoteCsv).join(",");
  appendFileSync(path, `${line}\n`);
}

function quoteCsv(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  if (!needsQuote) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function readFetchState(dataDir: string): Record<string, WorkState> {
  const path = join(dataDir, FETCH_STATE_PATH);
  const hasState = existsSync(path);
  if (!hasState) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { works?: Record<string, WorkState> };
    return parsed.works ?? {};
  } catch {
    return {};
  }
}

function writeFetchState(dataDir: string, works: Record<string, WorkState>, now: number): void {
  const state = { updated_at: new Date(now).toISOString(), works };
  writeText(dataDir, FETCH_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function writeText(dataDir: string, relPath: string, text: string): void {
  const path = join(dataDir, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
