import { useEffect, useState } from "react";

/** 取得のエラーが無いこと */
const NO_ERROR = null;

/**
 * マウント時と、画面が表示に戻るたび(`visibilitychange` で `visible`)に `fetch` を呼び、最後の結果を返す。
 *
 * @remarks
 * 何を取るか・どう並べるかは持たない(呼び出し側の `fetch`)。`fetch` は毎回同じ関数を渡す(モジュールの定数)。
 * 取得中は前の値を残して差し替える。成功したらエラーを消す。後から始めた取得より古い応答は捨てる。
 */
export function useFetchOnVisible<T>(fetch: () => Promise<T>, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [error, setError] = useState<string | null>(NO_ERROR);

  useEffect(() => {
    let latest = 0;
    let isAlive = true;
    const run = () => {
      latest += 1;
      const seq = latest;
      const isCurrent = () => isAlive && seq === latest;
      fetch()
        .then((next) => {
          if (!isCurrent()) return;
          setValue(next);
          setError(NO_ERROR);
        })
        .catch((e: Error) => {
          if (!isCurrent()) return;
          setError(e.message);
        });
    };
    const onVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      if (isVisible) run();
    };
    run();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      isAlive = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetch]);

  return { value, error };
}
