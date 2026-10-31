import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../../db/db";

/** 先頭の行が止まってから保存するまでの待ち(ms) */
const SAVE_DELAY_MS = 500;

/**
 * 読了位置。`key` は `${ref}:${path}`。保存した行を読み、画面の先頭の行が変わったら少し待って保存する。
 *
 * @remarks
 * どの行を開くか(出典リンクの行を優先するか)は呼び出し側が決める。
 */
export function useReadingPosition(key: string) {
  const [savedLine, setSavedLine] = useState<number | null>(null);
  useEffect(() => {
    void db.positions.get(key).then((p) => setSavedLine(p?.line ?? null));
  }, [key]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTopLine = useCallback(
    (line: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void db.positions.put({ key, line, updatedAt: new Date().toISOString() });
      }, SAVE_DELAY_MS);
    },
    [key],
  );
  return { savedLine, onTopLine };
}
