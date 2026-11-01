// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listHumanIssues } from "../../sync/github";
import { useHumanIssues } from "./useHumanIssues";

vi.mock("../../sync/github", () => ({
  listHumanIssues: vi.fn(),
  loadConfig: () => ({ owner: "o", repo: "r", token: "t", remember: false }),
}));

const issue = (number: number, labels: string[], isPull = false) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/o/r/issues/${number}`,
  body: "- [ ] 一",
  labels: labels.map((name) => ({ name })),
  ...(isPull ? { pull_request: {} } : {}),
});

describe("useHumanIssues", () => {
  beforeEach(() => {
    vi.mocked(listHumanIssues).mockReset();
  });

  it("human の Issue だけを並べ、PR は除く", async () => {
    vi.mocked(listHumanIssues).mockResolvedValue([issue(7, ["human"]), issue(8, ["human"], true)]);
    const { result } = renderHook(() => useHumanIssues());
    await waitFor(() => expect(result.current.issues).toHaveLength(1));
    expect(result.current.issues[0]).toMatchObject({
      number: 7,
      tasks: { unchecked: 1, total: 1 },
    });
    expect(result.current.error).toBeNull();
  });

  it("取得に失敗したらエラーを出す", async () => {
    vi.mocked(listHumanIssues).mockRejectedValue(new Error("403"));
    const { result } = renderHook(() => useHumanIssues());
    await waitFor(() => expect(result.current.error).toBe("403"));
    expect(result.current.issues).toEqual([]);
  });
});
