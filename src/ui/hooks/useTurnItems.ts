import { useEffect, useState } from "react";
import { getTurnItems, type TurnItem } from "../../core/turn";
import { listPulls, loadConfig } from "../../sync/github";
import { syncRef } from "../../sync/sync";
import { href, type Route } from "../router";

/** 同期中の項目が無いこと */
const NOT_OPENING = null;

/** 項目を押したときの読書画面のルート。設計段階なら設計書タブで開く */
export function toTurnRoute(item: TurnItem): Route {
  const route: Route = {
    page: "reader",
    work: item.work,
    ep: item.ep,
    ref: item.ref,
    pr: item.number,
  };
  const isDesignTab = item.tab === "design";
  if (!isDesignTab) return route;
  return { ...route, tab: "design" };
}

/**
 * 「あなたの番」の取得と、項目を開く処理。
 *
 * @remarks
 * どの PR が番かは持たない(`src/core/turn.ts`)。見た目は持たない(`TurnSection`)。
 */
export function useTurnItems(navigate: (to: string) => void) {
  const [items, setItems] = useState<TurnItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(NOT_OPENING);

  useEffect(() => {
    listPulls(loadConfig())
      .then((pulls) => setItems(getTurnItems(pulls)))
      .catch((e: Error) => setError(e.message));
  }, []);

  /** PR のブランチを同期してから、その話を開く。同期中は他の項目を開かない */
  const open = async (item: TurnItem) => {
    const isBusy = opening !== NOT_OPENING;
    if (isBusy) return;
    setOpening(item.number);
    try {
      await syncRef(loadConfig(), item.ref);
      navigate(href(toTurnRoute(item)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(NOT_OPENING);
    }
  };

  return { items, error, opening, open };
}
