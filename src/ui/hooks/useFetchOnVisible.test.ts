// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFetchOnVisible } from "./useFetchOnVisible";

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

describe("useFetchOnVisible", () => {
  afterEach(() => {
    cleanup();
    setVisibility("visible");
  });

  it("マウント時に取得する", async () => {
    const fetch = vi.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(result.current.value).toEqual(["a"]));
    expect(result.current.error).toBeNull();
  });

  it("表示に戻ったら取り直す", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(["a"]).mockResolvedValueOnce(["b"]);
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(result.current.value).toEqual(["a"]));
    setVisibility("visible");
    await waitFor(() => expect(result.current.value).toEqual(["b"]));
  });

  it("隠れたときは取り直さない", async () => {
    const fetch = vi.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(result.current.value).toEqual(["a"]));
    setVisibility("hidden");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("失敗の後に取り直して成功したらエラーを消す", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("403")).mockResolvedValueOnce(["a"]);
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(result.current.error).toBe("403"));
    setVisibility("visible");
    await waitFor(() => expect(result.current.value).toEqual(["a"]));
    expect(result.current.error).toBeNull();
  });

  it("取り直しが失敗しても前の値を残す", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(["a"]).mockRejectedValueOnce(new Error("503"));
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(result.current.value).toEqual(["a"]));
    setVisibility("visible");
    await waitFor(() => expect(result.current.error).toBe("503"));
    expect(result.current.value).toEqual(["a"]);
  });

  it("後から始めた取得より遅れて返った古い応答は捨てる", async () => {
    let finishFirst: (value: string[]) => void = () => {};
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<string[]>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(["new"]);
    const { result } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    setVisibility("visible");
    await waitFor(() => expect(result.current.value).toEqual(["new"]));
    await act(async () => {
      finishFirst(["old"]);
    });
    expect(result.current.value).toEqual(["new"]);
  });

  it("外したら購読をやめる", async () => {
    const fetch = vi.fn().mockResolvedValue(["a"]);
    const { unmount } = renderHook(() => useFetchOnVisible(fetch, [] as string[]));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    unmount();
    setVisibility("visible");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
