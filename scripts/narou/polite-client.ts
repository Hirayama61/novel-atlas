// なろうへの取得の間隔を守る HTTP の窓口。CLAUDE.md の取得作法(2.5 秒/リクエスト)。

/** リクエストの最小間隔(ミリ秒)。api.syosetu と ncode.syosetu を合わせて数える */
export const REQUEST_INTERVAL_MS = 2500;

/** 取得元に名乗る User-Agent */
const USER_AGENT = "novel-atlas-collector (personal reading; 1 request per 2.5s)";

/** 最初のリクエストの前は待たない */
const NO_PREVIOUS_REQUEST = Number.NEGATIVE_INFINITY;

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export type GetResult = { kind: "ok"; body: string } | { kind: "http-error"; status: number };

export interface PoliteClient {
  /** 前のリクエストから間隔を空けて GET する。通信の失敗は例外のまま投げる */
  get: (url: string) => Promise<GetResult>;
}

export const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * 間隔を守る窓口を作る。
 *
 * @remarks
 * 間隔は前のリクエストを送った時刻から数える。並行には送らない(呼び手が 1 件ずつ待つ)。
 */
export function createPoliteClient(fetchFn: FetchFn, clock: Clock): PoliteClient {
  let lastSentAt = NO_PREVIOUS_REQUEST;
  return {
    get: async (url) => {
      const wait = getWaitMs(lastSentAt, clock.now());
      if (wait > 0) await clock.sleep(wait);
      lastSentAt = clock.now();
      const res = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) return { kind: "http-error", status: res.status };
      return { kind: "ok", body: await res.text() };
    },
  };
}

/** 次のリクエストまでに待つミリ秒 */
export function getWaitMs(lastSentAt: number, now: number): number {
  return Math.max(0, lastSentAt + REQUEST_INTERVAL_MS - now);
}
