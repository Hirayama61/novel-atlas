import { useCallback, useEffect, useState } from "react";
import { buildDataSet, type DataSet } from "../core/data/work";
import { filesOf } from "../db/db";
import { syncRef } from "../sync/sync";
import { loadConfig } from "../sync/github";

/** 同期の結果。失敗したときは画面に出す理由を持つ */
export type SyncResult = { kind: "ok" } | { kind: "error"; reason: string };

export interface DataState {
  data: DataSet | null;
  files: Map<string, string> | null;
  loading: boolean;
  error: string | null;
  sync: () => Promise<SyncResult>;
  progress: string | null;
}

/** ref のデータを手元の IndexedDB から組み立てる。無ければ同期する */
export function useData(ref: string): DataState {
  const [files, setFiles] = useState<Map<string, string> | null>(null);
  const [data, setData] = useState<DataSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    const f = await filesOf(ref);
    setFiles(f);
    setData(f ? buildDataSet(f).data : null);
    return f;
  }, [ref]);

  const sync = useCallback(async (): Promise<SyncResult> => {
    const config = loadConfig();
    if (!config.token) {
      const reason = "設定でトークンを入れてください";
      setError(reason);
      return { kind: "error", reason };
    }
    setError(null);
    setProgress("同期中…");
    try {
      await syncRef(config, ref, (p) => setProgress(`同期中… ${p.done}/${p.total}`));
      await load();
      return { kind: "ok" };
    } catch (e) {
      const reason = (e as Error).message;
      setError(reason);
      return { kind: "error", reason };
    } finally {
      setProgress(null);
    }
  }, [ref, load]);

  useEffect(() => {
    // ref が変わるときは呼び出し側が key で作り直すので、loading は初期値の true から始まる
    let alive = true;
    // load は最初に IndexedDB を await するので、effect の中で同期的に setState しない
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then(async (f) => {
        if (!f && alive && loadConfig().token) await sync();
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, sync]);

  return { data, files, loading, error, sync, progress };
}
