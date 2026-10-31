import { expect, test } from "@playwright/test";
import { mockGitHub } from "./fixture";

test("同期して作品を開き、本文を縦書きで読む", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("./");
  await page.getByRole("link", { name: "灯台守の娘" }).click();
  await page.getByRole("link", { name: "灯台の夜" }).click();
  await expect(page.getByText("父の目はもう灯を追えない。")).toBeVisible();
  await page.getByRole("button", { name: "縦書き" }).click();
  await expect(page.locator(".text.vertical")).toBeVisible();
  await page.getByRole("link", { name: "← 一覧" }).click();
  await page.getByRole("link", { name: "人物" }).click();
  await expect(page.getByText("ミオ")).toBeVisible();
});

test("PR の本文の段落にコメントを書き、まとめて 1 件のレビューとして送る", async ({ page }) => {
  const state = await mockGitHub(page);
  await page.goto("./#/pulls");
  await page.getByRole("button", { name: /第3話 灯を消す/ }).click();
  await expect(page.getByText("父は灯を点けなかった。")).toBeVisible();

  await page.getByText("嵐が来た。").click();
  await page.getByRole("button", { name: "段落ごと選ぶ" }).click();
  await page.getByPlaceholder("コメント").fill("父の沈黙をもう一拍");
  await page.getByRole("button", { name: "下書きに足す" }).click();

  await page.getByText("ミオは灯を消した。").click();
  await page.getByPlaceholder("コメント").fill("ここは良い");
  await page.getByRole("button", { name: "下書きに足す" }).click();

  await page.getByRole("button", { name: "まとめて送る(2)" }).click();
  await expect(page.getByText("2 件を送りました")).toBeVisible();

  const review = state.reviews[0] as {
    commit_id: string;
    event: string;
    comments: { path: string; line: number; start_line?: number; body: string }[];
  };
  expect(review.commit_id).toBe("branch_c");
  expect(review.event).toBe("COMMENT");
  expect(review.comments[0]).toMatchObject({
    path: "works/lh/episodes/003/text.md",
    start_line: 3,
    line: 4,
  });
  expect(review.comments[0]!.body).toContain("> 嵐が来た。");
  expect(review.comments[0]!.body).toContain('<!-- atlas:{"ep":3,"lines":[3,4]');
  expect(review.comments[1]).toMatchObject({ line: 6 });
});

test("設計書タブを読み、設計を承認する", async ({ page }) => {
  const state = await mockGitHub(page);
  state.labels.splice(0, state.labels.length, "stage:design");
  await page.goto("./#/pulls");
  await page.getByRole("button", { name: /第3話 灯を消す/ }).click();
  await page.getByRole("button", { name: "設計書" }).click();
  await expect(page.getByText("消えた灯と娘の影")).toBeVisible();
  await page.getByRole("button", { name: "設計を承認" }).click();
  await expect(page.getByText("design-approved を付けました")).toBeVisible();
  expect(state.labels).toContain("design-approved");
});

test("ライブラリの先頭の「あなたの番」から、読む番の話を開く", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "あなたの番" })).toBeVisible();
  await expect(page.getByText("読む", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "灯台守の娘 第3話" }).click();
  await expect(page.getByText("父は灯を点けなかった。")).toBeVisible();
});

test("設計の承認待ちは設計書を開き、番の PR が無ければ節を出さない", async ({ page }) => {
  const state = await mockGitHub(page);
  state.labels.splice(0, state.labels.length, "stage:design");
  await page.goto("./");
  await expect(page.getByText("設計を承認する")).toBeVisible();
  await page.getByRole("button", { name: "灯台守の娘 第3話" }).click();
  await expect(page.getByText("消えた灯と娘の影")).toBeVisible();

  state.labels.splice(0, state.labels.length, "stage:drafting");
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "作品" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "あなたの番" })).toHaveCount(0);
});

test("設定画面のシートから ready 付きの改善 Issue を作り、失敗では下書きを残す", async ({
  page,
}) => {
  const state = await mockGitHub(page);
  state.issueStatus = 403;
  await page.goto("./#/settings");
  await page.getByRole("button", { name: "改善 Issue を書く" }).click();
  await expect(page.getByText("公開リポジトリなので、未公開の設定を書かない。")).toBeVisible();
  await page.getByLabel("題").fill("縦書きの字詰めを細かく選びたい");
  await page.getByLabel("本文").fill("1 字ずつ選べると読みやすい");

  await page.getByRole("button", { name: "Issue を作る" }).click();
  await expect(page.getByText(/Issues: Read and write を足してください/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "改善 Issue を書く" }).click();
  await expect(page.getByLabel("題")).toHaveValue("縦書きの字詰めを細かく選びたい");

  state.issueStatus = 200;
  await page.getByRole("button", { name: "Issue を作る" }).click();
  await expect(page.getByText("を作りました")).toBeVisible();
  expect(state.issues[0]).toEqual({
    title: "縦書きの字詰めを細かく選びたい",
    body: "1 字ずつ選べると読みやすい",
    labels: ["ready"],
  });
  await expect(page.getByLabel("題")).toHaveValue("");
});

test("改善 Issue の送信中は入力と閉じるを無効にし、1 件だけ作る", async ({ page }) => {
  const state = await mockGitHub(page);
  let release = () => {};
  state.holdIssue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto("./#/settings");
  await page.getByRole("button", { name: "改善 Issue を書く" }).click();
  await page.getByLabel("題").fill("縦書きの字詰めを細かく選びたい");
  await page.getByLabel("本文").fill("1 字ずつ選べると読みやすい");
  await page.getByRole("button", { name: "Issue を作る" }).click();

  await expect(page.getByRole("button", { name: "送信中…" })).toBeDisabled();
  await expect(page.getByLabel("題")).toBeDisabled();
  await expect(page.getByLabel("本文")).toBeDisabled();
  await expect(page.getByRole("button", { name: "閉じる" })).toBeDisabled();

  release();
  await expect(page.getByText("を作りました")).toBeVisible();
  expect(state.issues).toHaveLength(1);
});
