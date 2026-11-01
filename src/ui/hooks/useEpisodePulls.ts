import { useEffect, useState } from "react";
import { getEpisodePulls, type EpisodePull } from "../../core/turn";
import { listPulls, loadConfig } from "../../sync/github";
import { syncRef } from "../../sync/sync";
import { href } from "../router";

/** 同期中の話が無いこと */
const NOT_OPENING = null;

/**
 * 話の一覧で使う、進行中の話の PR の取得と、その話を開く処理。
 *
 * @remarks
 * どの PR がどの話かは持たない(`getEpisodePulls`)。見た目は持たない(`WorkPage`)。
 * トークンが無ければ取得せず、一覧は main の話だけになる。
 */
export function useEpisodePulls(work: string, navigate: (to: string) => void) {
  const [pulls, setPulls] = useState<Map<number, EpisodePull>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(NOT_OPENING);

  useEffect(() => {
    const c = loadConfig();
    const hasToken = !!c.token;
    if (!hasToken) return;
    listPulls(c)
      .then((ps) => setPulls(getEpisodePulls(ps, work)))
      .catch((e: Error) => setError(e.message));
  }, [work]);

  /** PR のブランチを同期してから、コメントできる読書画面で開く。同期中は他の話を開かない */
  const open = async (ep: number, pull: EpisodePull) => {
    const isBusy = opening !== NOT_OPENING;
    if (isBusy) return;
    setOpening(ep);
    try {
      await syncRef(loadConfig(), pull.ref);
      navigate(href({ page: "reader", work, ep, ref: pull.ref, pr: pull.number }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(NOT_OPENING);
    }
  };

  return { pulls, error, opening, open };
}
