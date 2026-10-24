import type { DataSet } from "./data/work";
import { countChars } from "./check/text";

/** データリポジトリ直下の index.json。ビューアが作品・話の一覧を 1 リクエストで出すための軽量版 */
export interface IndexFile {
  version: 1;
  generatedAt: string;
  works: {
    id: string;
    title: string;
    status: string;
    episodes: { no: number; title: string | null; status: string | null; chars: number }[];
    characters: number;
    threads: number;
  }[];
}

/** 本文の見出し行「# 第N話 題」から題を取る */
export function titleFromText(text: string): string | null {
  const m = /^#\s*第\s*\d+\s*話\s*(.*)$/m.exec(text);
  return m?.[1]?.trim() || null;
}

export function buildIndex(data: DataSet, now = new Date()): IndexFile {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    works: [...data.works.values()]
      .filter((w) => w.work)
      .map((w) => ({
        id: w.id,
        title: w.work!.title,
        status: w.work!.status,
        episodes: [...w.episodes.values()]
          .filter((e) => e.text || e.design)
          .sort((a, b) => a.no - b.no)
          .map((e) => ({
            no: e.no,
            title:
              e.design?.title.final ??
              (e.text ? titleFromText(e.text) : null) ??
              e.design?.title.working ??
              null,
            status: e.design?.status ?? null,
            chars: e.text ? countChars(e.text) : 0,
          })),
        characters: w.characters.length,
        threads: w.threads.length,
      })),
  };
}
