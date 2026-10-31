// 同期済みのファイルから、読書画面で読む参考作品の棚を組み立てる。本文は端末の IndexedDB にだけある。
import { parseReferencesCsv, REFERENCES_CSV_PATH } from "./references";

export interface ReferenceShelfWork {
  ncode: string;
  /** 一覧の題名、無ければ meta.json の題名、どちらも無ければ ncode */
  title: string;
  /** 本文のある話の番号(昇順) */
  episodes: number[];
}

/** 参考作品の話のパス。`scripts/narou/episode-html.ts` の `getEpisodePath` と同じ形 */
export function getReferenceEpisodePath(ncode: string, episode: number): string {
  return `references/${ncode}/episodes/${String(episode).padStart(3, "0")}.md`;
}

const EPISODE_PATH_RE = /^references\/([^/]+)\/episodes\/(\d+)\.md$/;

/** 題名が無い */
const NO_TITLE = "";

/**
 * 本文が 1 話以上ある参考作品を ncode 順に並べる。
 *
 * @remarks
 * 本文は持たない(読書画面がパスで引く)。題名は一覧(works.csv)を先に、meta.json を後に見る。
 */
export function getReferenceShelf(files: Map<string, string>): ReferenceShelfWork[] {
  const episodesByNcode = new Map<string, number[]>();
  for (const path of files.keys()) {
    const m = EPISODE_PATH_RE.exec(path);
    if (m === null) continue;
    const ncode = m[1]!;
    const episodes = episodesByNcode.get(ncode) ?? [];
    episodes.push(Number(m[2]));
    episodesByNcode.set(ncode, episodes);
  }
  const csvTitles = new Map(
    parseReferencesCsv(files.get(REFERENCES_CSV_PATH) ?? "").map((w) => [w.ncode, w.title.trim()]),
  );
  return [...episodesByNcode]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ncode, episodes]) => ({
      ncode,
      title: getReferenceTitle(ncode, csvTitles.get(ncode) ?? NO_TITLE, files),
      episodes: episodes.sort((a, b) => a - b),
    }));
}

function getReferenceTitle(ncode: string, csvTitle: string, files: Map<string, string>): string {
  const hasCsvTitle = csvTitle !== NO_TITLE;
  if (hasCsvTitle) return csvTitle;
  const metaTitle = getMetaTitle(files.get(`references/${ncode}/meta.json`));
  const hasMetaTitle = metaTitle !== NO_TITLE;
  if (hasMetaTitle) return metaTitle;
  return ncode;
}

/** meta.json(なろう API の 1 作品分)の `title`。読めなければ空 */
function getMetaTitle(text: string | undefined): string {
  if (text === undefined) return NO_TITLE;
  try {
    const meta = JSON.parse(text) as unknown;
    const isObject = typeof meta === "object" && meta !== null;
    if (!isObject) return NO_TITLE;
    const title = (meta as Record<string, unknown>).title;
    const isTitle = typeof title === "string";
    if (!isTitle) return NO_TITLE;
    return title.trim();
  } catch {
    return NO_TITLE;
  }
}

/** 続きの話の番号。最後の話なら `null` */
export function getNextEpisode(episodes: number[], episode: number): number | null {
  return episodes.find((n) => n > episode) ?? null;
}
