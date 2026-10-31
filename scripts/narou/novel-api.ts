// なろう小説 API(全年齢の api.syosetu.com/novelapi)の URL と応答の読み取り。

/** 全年齢の小説 API。年齢制限のある作品(novel18api)はここに返らない */
const NOVEL_API_URL = "https://api.syosetu.com/novelapi/api/";

/** API の `noveltype` で短編を表す値 */
const SHORT_STORY_TYPE = 2;

/** 応答の 1 件目にある件数で、作品が見つからないことを表す値 */
const NOT_FOUND_COUNT = 0;

/** meta.json に書く作品情報。API の 1 作品分をそのまま持つ */
export type NovelMeta = Record<string, unknown>;

export type NovelMetaResult =
  | { kind: "ok"; meta: NovelMeta; episodeCount: number; isShortStory: boolean }
  | { kind: "error"; reason: string };

/** 1 作品の作品情報を取る URL。全年齢の API だけを使う */
export function getNovelMetaUrl(ncode: string): string {
  const params = new URLSearchParams({ out: "json", ncode });
  return `${NOVEL_API_URL}?${params.toString()}`;
}

/**
 * API の応答(JSON の文字列)から作品情報と話数を読む。
 *
 * @remarks
 * 全年齢の API に無い作品(削除・非公開・年齢制限)は `error` にする。取得するかどうかは呼び手が決める。
 */
export function parseNovelMeta(body: string): NovelMetaResult {
  const parsed = parseJson(body);
  const isList = Array.isArray(parsed);
  if (!isList) return { kind: "error", reason: "API の応答が配列ではありません" };
  const [head, item] = parsed as unknown[];
  const count = getNumber(head, "allcount");
  const isMissing = count === undefined || count === NOT_FOUND_COUNT || !isRecord(item);
  if (isMissing)
    return {
      kind: "error",
      reason: "全年齢の API に作品がありません(削除・非公開・年齢制限のいずれか)",
    };
  const meta = item as NovelMeta;
  const episodeCount = getNumber(meta, "general_all_no");
  const hasEpisodeCount = episodeCount !== undefined && episodeCount > 0;
  if (!hasEpisodeCount) return { kind: "error", reason: "API の応答に話数がありません" };
  const isShortStory = getNumber(meta, "noveltype") === SHORT_STORY_TYPE;
  return { kind: "ok", meta, episodeCount, isShortStory };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  const isNumber = typeof field === "number" && Number.isFinite(field);
  if (!isNumber) return undefined;
  return field;
}
