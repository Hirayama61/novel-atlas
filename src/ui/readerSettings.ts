import { useState } from "react";

export interface ReaderSettings {
  vertical: boolean;
  /** 1 行の字数(字詰め) */
  charsPerLine: number;
  fontSize: number;
  lineHeight: number;
}

const KEY = "novel-atlas.reader";
export const DEFAULT_READER: ReaderSettings = {
  vertical: false,
  charsPerLine: 32,
  fontSize: 18,
  lineHeight: 1.9,
};

export function loadReaderSettings(): ReaderSettings {
  try {
    return {
      ...DEFAULT_READER,
      ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ReaderSettings>),
    };
  } catch {
    return DEFAULT_READER;
  }
}

export function useReaderSettings(): [ReaderSettings, (s: Partial<ReaderSettings>) => void] {
  const [s, set] = useState(loadReaderSettings);
  const update = (patch: Partial<ReaderSettings>) => {
    const next = { ...s, ...patch };
    set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // 保存できなくても読書はできる
    }
  };
  return [s, update];
}
