import { useState } from "react";
import { getTurnItems, type TurnItem } from "../../core/turn";
import { listPulls, loadConfig } from "../../sync/github";
import { syncRef } from "../../sync/sync";
import { href, type Route } from "../router";
import { useFetchOnVisible } from "./useFetchOnVisible";

/** 同期中の項目が無いこと */
const NOT_OPENING = null;

/** 取得前の一覧 */
const NO_ITEMS: TurnItem[] = [];

/** 開く処理のエラーが無いこと */
const NO_OPEN_ERROR = null;

/** open の PR を取り、依頼者の番の話に絞る */
const fetchTurnItems = () => listPulls(loadConfig()).then((pulls) => getTurnItems(pulls));

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
 * 「あなたの番」の取得と、項目を開く処理。画面が表示に戻るたびに取り直す。
 *
 * @remarks
 * どの PR が番かは持たない(`src/core/turn.ts`)。見た目は持たない(`TurnSection`)。
 * 開く処理の失敗は取り直しで消さない。両方あれば開く処理の失敗を出す。
 */
export function useTurnItems(navigate: (to: string) => void) {
  const { value: items, error: listError } = useFetchOnVisible(fetchTurnItems, NO_ITEMS);
  const [openError, setOpenError] = useState<string | null>(NO_OPEN_ERROR);
  const [opening, setOpening] = useState<number | null>(NOT_OPENING);
  const error = openError ?? listError;

  /** PR のブランチを同期してから、その話を開く。同期中は他の項目を開かない */
  const open = async (item: TurnItem) => {
    const isBusy = opening !== NOT_OPENING;
    if (isBusy) return;
    setOpening(item.number);
    try {
      await syncRef(loadConfig(), item.ref);
      navigate(href(toTurnRoute(item)));
    } catch (e) {
      setOpenError((e as Error).message);
    } finally {
      setOpening(NOT_OPENING);
    }
  };

  return { items, error, opening, open };
}
