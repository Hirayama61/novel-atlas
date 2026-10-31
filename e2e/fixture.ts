import { createHash } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import { DESIGN_3, FILES } from "../src/core/__tests__/fixtures";

const sha = (s: string) => createHash("sha1").update(s).digest("hex");

export interface MockState {
  reviews: unknown[];
  labels: string[];
  /** 本体リポジトリに作った Issue の POST の中身 */
  issues: unknown[];
  /** 次の Issue 作成に返す状態。200 以外なら失敗させる */
  issueStatus: number;
  /** あれば、Issue 作成の応答をこの Promise が解決するまで待たせる */
  holdIssue?: Promise<void>;
}

const PR_BRANCH = "ep/lh/003";
const PR_TEXT = `# 第3話 灯を消す

　嵐が来た。
　父は灯を点けなかった。

　ミオは灯を消した。
`;

/** データリポジトリ(架空の作品)と PR 1 本をモックする */
export async function mockGitHub(page: Page): Promise<MockState> {
  const state: MockState = {
    reviews: [],
    labels: ["stage:reading"],
    issues: [],
    issueStatus: 200,
  };
  const main = new Map(FILES);
  const branch = new Map([
    ...FILES,
    ["works/lh/episodes/003/design.yaml", DESIGN_3],
    ["works/lh/episodes/003/text.md", PR_TEXT],
  ]);
  const blobs = new Map<string, string>();
  const tree = (files: Map<string, string>) =>
    [...files].map(([path, content]) => {
      const s = sha(content);
      blobs.set(s, content);
      return { path, sha: s, type: "blob" };
    });
  const commits: Record<string, Map<string, string>> = { main_c: main, branch_c: branch };

  const api = "https://api.github.com/repos/Hirayama61/novel-atlas-data";
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route(`${api}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname.replace("/repos/Hirayama61/novel-atlas-data", ""));
    const method = route.request().method();
    if (path === "/commits/main") return route.fulfill({ body: "main_c" });
    if (path === `/commits/${PR_BRANCH}`) return route.fulfill({ body: "branch_c" });
    const t = /^\/git\/trees\/(.+)$/.exec(path);
    if (t)
      return json(route, { sha: `tree_${t[1]}`, truncated: false, tree: tree(commits[t[1]!]!) });
    const b = /^\/git\/blobs\/(.+)$/.exec(path);
    if (b) return route.fulfill({ body: blobs.get(b[1]!) ?? "" });
    const pr = {
      number: 3,
      title: "[lh] 第3話 灯を消す",
      html_url: "https://github.com/x/y/pull/3",
      head: { ref: PR_BRANCH, sha: "branch_c" },
      updated_at: "",
    };
    if (path === "/pulls")
      return json(route, [{ ...pr, labels: state.labels.map((name) => ({ name })) }]);
    if (path === "/pulls/3")
      return json(route, { ...pr, labels: state.labels.map((name) => ({ name })) });
    if (path === "/pulls/3/files")
      return json(route, [
        { filename: "works/lh/episodes/003/text.md", status: "added" },
        { filename: "works/lh/episodes/003/design.yaml", status: "added" },
      ]);
    if (path === "/pulls/3/comments") return json(route, []);
    if (path === "/pulls/3/reviews" && method === "POST") {
      state.reviews.push(route.request().postDataJSON());
      return json(route, { id: 1 });
    }
    if (path === "/issues/3/labels" && method === "POST") {
      state.labels.push(...(route.request().postDataJSON() as { labels: string[] }).labels);
      return json(route, []);
    }
    return json(route, { message: `not mocked: ${method} ${path}` }, 404);
  });

  await page.route("https://api.github.com/repos/Hirayama61/novel-atlas/issues", async (route) => {
    if (state.issueStatus !== 200)
      return json(route, { message: "Resource not accessible" }, state.issueStatus);
    state.issues.push(route.request().postDataJSON());
    await state.holdIssue;
    return json(route, { number: 42, html_url: "https://github.com/x/y/issues/42" }, 201);
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "novel-atlas.dataRepo",
      JSON.stringify({
        owner: "Hirayama61",
        repo: "novel-atlas-data",
        token: "test-token",
        remember: true,
      }),
    );
  });
  return state;
}
