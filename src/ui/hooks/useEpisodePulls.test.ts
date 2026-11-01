// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPulls, loadConfig } from "../../sync/github";
import { syncRef } from "../../sync/sync";
import { useEpisodePulls } from "./useEpisodePulls";

vi.mock("../../sync/github", () => ({
  listPulls: vi.fn(),
  loadConfig: vi.fn(),
}));
vi.mock("../../sync/sync", () => ({ syncRef: vi.fn() }));

const config = (token: string) => ({ owner: "o", repo: "r", token, remember: false });

const pull = (number: number, ref: string) => ({
  number,
  title: `PR ${number}`,
  html_url: "",
  head: { ref, sha: "" },
  labels: [{ name: "stage:reading" }],
  updated_at: "",
});

describe("useEpisodePulls", () => {
  beforeEach(() => {
    vi.mocked(listPulls).mockReset();
    vi.mocked(syncRef).mockReset();
    vi.mocked(loadConfig).mockReturnValue(config("t"));
  });

  it("その作品の話の PR を話数で引く", async () => {
    vi.mocked(listPulls).mockResolvedValue([pull(3, "ep/lh/003"), pull(4, "ep/x/001")]);
    const { result } = renderHook(() => useEpisodePulls("lh", vi.fn()));
    await waitFor(() => expect(result.current.pulls.size).toBe(1));
    expect(result.current.pulls.get(3)).toMatchObject({ number: 3, ref: "ep/lh/003" });
  });

  it("トークンが無ければ取得しない", () => {
    vi.mocked(loadConfig).mockReturnValue(config(""));
    const { result } = renderHook(() => useEpisodePulls("lh", vi.fn()));
    expect(listPulls).not.toHaveBeenCalled();
    expect(result.current.pulls.size).toBe(0);
  });

  it("取得に失敗したらエラーを出す", async () => {
    vi.mocked(listPulls).mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useEpisodePulls("lh", vi.fn()));
    await waitFor(() => expect(result.current.error).toBe("401"));
  });

  it("ブランチを同期してから、PR 付きの読書画面へ移る", async () => {
    vi.mocked(listPulls).mockResolvedValue([pull(3, "ep/lh/003")]);
    vi.mocked(syncRef).mockResolvedValue(undefined as never);
    const navigate = vi.fn();
    const { result } = renderHook(() => useEpisodePulls("lh", navigate));
    await waitFor(() => expect(result.current.pulls.size).toBe(1));
    await act(() => result.current.open(3, result.current.pulls.get(3)!));
    expect(syncRef).toHaveBeenCalledWith(expect.anything(), "ep/lh/003");
    expect(navigate).toHaveBeenCalledWith("#/w/lh/e/3?ref=ep%2Flh%2F003&pr=3");
  });
});
