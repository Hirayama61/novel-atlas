// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnItem } from "../../core/turn";
import { listPulls } from "../../sync/github";
import { syncRef } from "../../sync/sync";
import { toTurnRoute, useTurnItems } from "./useTurnItems";

vi.mock("../../sync/github", () => ({
  listPulls: vi.fn(),
  loadConfig: () => ({ owner: "o", repo: "r", token: "t", remember: false }),
}));
vi.mock("../../sync/sync", () => ({ syncRef: vi.fn() }));

const pull = (number: number, ref: string, labels: string[]) => ({
  number,
  title: "",
  html_url: "",
  head: { ref, sha: "" },
  labels: labels.map((name) => ({ name })),
  updated_at: "",
});

const item = (tab: TurnItem["tab"]): TurnItem => ({
  number: 3,
  ref: "ep/lh/003",
  work: "lh",
  ep: 3,
  kind: "reading",
  tab,
});

describe("toTurnRoute", () => {
  it("本文の番は本文で開く", () => {
    expect(toTurnRoute(item("text"))).toEqual({
      page: "reader",
      work: "lh",
      ep: 3,
      ref: "ep/lh/003",
      pr: 3,
    });
  });
  it("設計段階は設計書タブで開く", () => {
    expect(toTurnRoute(item("design"))).toMatchObject({ page: "reader", tab: "design" });
  });
});

describe("useTurnItems", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(listPulls).mockReset();
    vi.mocked(syncRef).mockReset();
  });

  it("open の PR から番の話だけを並べる", async () => {
    vi.mocked(listPulls).mockResolvedValue([
      pull(3, "ep/lh/003", ["stage:reading"]),
      pull(4, "ep/lh/004", ["stage:drafting"]),
    ]);
    const { result } = renderHook(() => useTurnItems(vi.fn()));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]).toMatchObject({ number: 3, kind: "reading" });
    expect(result.current.error).toBeNull();
  });

  it("取得に失敗したらエラーを出す", async () => {
    vi.mocked(listPulls).mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useTurnItems(vi.fn()));
    await waitFor(() => expect(result.current.error).toBe("401"));
    expect(result.current.items).toEqual([]);
  });

  it("ブランチを同期してから読書画面へ移る", async () => {
    vi.mocked(listPulls).mockResolvedValue([pull(3, "ep/lh/003", ["stage:design"])]);
    vi.mocked(syncRef).mockResolvedValue(undefined as never);
    const navigate = vi.fn();
    const { result } = renderHook(() => useTurnItems(navigate));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(() => result.current.open(result.current.items[0]!));
    expect(syncRef).toHaveBeenCalledWith(expect.anything(), "ep/lh/003");
    expect(navigate).toHaveBeenCalledWith("#/w/lh/e/3?ref=ep%2Flh%2F003&pr=3&tab=design");
    expect(result.current.opening).toBeNull();
  });

  it("同期中は他の項目を開かない", async () => {
    vi.mocked(listPulls).mockResolvedValue([
      pull(3, "ep/lh/003", ["stage:reading"]),
      pull(5, "ep/lh/005", ["stage:reading"]),
    ]);
    let finish = () => {};
    vi.mocked(syncRef).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve(undefined as never);
      }),
    );
    const navigate = vi.fn();
    const { result } = renderHook(() => useTurnItems(navigate));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    let first = Promise.resolve();
    act(() => {
      first = result.current.open(result.current.items[0]!);
    });
    await waitFor(() => expect(result.current.opening).toBe(3));
    await act(() => result.current.open(result.current.items[1]!));
    expect(syncRef).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
      await first;
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(result.current.opening).toBeNull();
  });

  it("同期に失敗したらエラーを出し、また開けるようにする", async () => {
    vi.mocked(listPulls).mockResolvedValue([pull(3, "ep/lh/003", ["stage:reading"])]);
    vi.mocked(syncRef).mockRejectedValue(new Error("network"));
    const navigate = vi.fn();
    const { result } = renderHook(() => useTurnItems(navigate));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(() => result.current.open(result.current.items[0]!));
    expect(result.current.error).toBe("network");
    expect(result.current.opening).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("表示に戻ったら取り直す", async () => {
    vi.mocked(listPulls)
      .mockResolvedValueOnce([pull(3, "ep/lh/003", ["stage:reading"])])
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useTurnItems(vi.fn()));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });

  it("取り直しが成功しても開く処理の失敗は消さない", async () => {
    vi.mocked(listPulls).mockResolvedValue([pull(3, "ep/lh/003", ["stage:reading"])]);
    vi.mocked(syncRef).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useTurnItems(vi.fn()));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(() => result.current.open(result.current.items[0]!));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(listPulls).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBe("network");
  });
});
