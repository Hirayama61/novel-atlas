import { expect, test, type Page } from "@playwright/test";
import { mockGitHub, REFERENCE_NCODE } from "./fixture";

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
  await expect(page.getByRole("heading", { name: "作品", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "あなたの番" })).toHaveCount(0);
});

test("「あなたの番」に human の Issue を未チェックの数と並べ、GitHub の Issue へのリンクにする", async ({
  page,
}) => {
  const state = await mockGitHub(page);
  state.labels.splice(0, state.labels.length, "stage:drafting");
  state.humanIssues = [
    {
      number: 21,
      title: "灯台の写真を撮りに行く",
      html_url: "https://github.com/Hirayama61/novel-atlas/issues/21",
      body: "- [ ] 港\n- [x] 岬\n- [ ] 灯室",
      labels: [{ name: "human" }],
    },
    {
      number: 22,
      title: "PR は出さない",
      html_url: "https://github.com/Hirayama61/novel-atlas/pull/22",
      body: "",
      labels: [{ name: "human" }],
      pull_request: {},
    },
  ];
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "あなたの番" })).toBeVisible();
  const link = page.getByRole("link", { name: "灯台の写真を撮りに行く" });
  await expect(link).toHaveAttribute("href", "https://github.com/Hirayama61/novel-atlas/issues/21");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("残り 2/3")).toBeVisible();
  await expect(page.getByRole("link", { name: "PR は出さない" })).toHaveCount(0);
});

test("ヘッダーのシートから ready 付きの改善 Issue を作り、失敗では下書きを残す", async ({
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

for (const { place, open } of [
  {
    place: "ライブラリ",
    open: async (page: Page) => {
      await page.goto("./");
      await expect(page.getByRole("link", { name: "灯台守の娘" })).toBeVisible();
    },
  },
  {
    place: "読書画面",
    open: async (page: Page) => {
      await page.goto("./");
      await page.getByRole("link", { name: "灯台守の娘" }).click();
      await page.getByRole("link", { name: "灯台の夜" }).click();
      await expect(page.getByText("父の目はもう灯を追えない。")).toBeVisible();
    },
  },
]) {
  test(`${place}からヘッダーの「改善」でシートを開き、改善 Issue を送って作った Issue へのリンクを出す`, async ({
    page,
  }) => {
    const state = await mockGitHub(page);
    await open(page);
    await page.getByRole("button", { name: "改善 Issue を書く" }).click();
    await page.getByLabel("題").fill("縦書きの字詰めを細かく選びたい");
    await page.getByLabel("本文").fill("1 字ずつ選べると読みやすい");
    await page.getByRole("button", { name: "Issue を作る" }).click();

    await expect(page.getByRole("link", { name: "#42" })).toHaveAttribute("href", /\/issues\/42$/);
    expect(state.issues).toHaveLength(1);
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.getByLabel("題")).toHaveCount(0);
  });
}

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

test("ライブラリで参考作品を登録し、二度目と対応しない URL は理由を出し、一覧から外す", async ({
  page,
}) => {
  const state = await mockGitHub(page);
  state.contentPutStatuses.push(409);
  await page.goto("./");
  const input = page.getByLabel("作品 URL か ncode");

  await input.fill("https://ncode.syosetu.com/n1234ab/3/");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText("n1234ab を登録しました")).toBeVisible();
  await expect(page.getByRole("button", { name: "n1234ab を一覧から外す" })).toBeVisible();
  expect(state.contentPuts).toHaveLength(2);
  expect(state.contentPuts[1]).toMatchObject({
    path: "references/works.csv",
    text: "ncode,title,volumes,note\nn1234ab,,,\n",
  });

  await input.fill("N1234AB");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText("n1234ab は登録済みです")).toBeVisible();

  await input.fill("https://kakuyomu.jp/works/1");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(
    page.getByText("小説家になろう(ncode.syosetu.com)の URL だけ登録できます"),
  ).toBeVisible();
  expect(state.contentPuts).toHaveLength(2);

  await page.getByRole("button", { name: "n1234ab を一覧から外す" }).click();
  await expect(page.getByText("n1234ab を一覧から外しました")).toBeVisible();
  await expect(page.getByText("登録した作品はまだありません。")).toBeVisible();
  expect(state.contentPuts[2]!.text).toBe("ncode,title,volumes,note\n");
});

test("参考作品の登録のあとに同期が失敗したら、登録しましたとは出さず同期し直すよう促す", async ({
  page,
}) => {
  const state = await mockGitHub(page);
  await page.goto("./");
  const input = page.getByLabel("作品 URL か ncode");
  await expect(input).toBeVisible();
  await page.route(
    "https://api.github.com/repos/Hirayama61/novel-atlas-data/commits/main",
    (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' }),
  );

  await input.fill("n1234ab");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByRole("alert")).toContainText("手元の同期に失敗");
  await expect(page.getByText("n1234ab を登録しました", { exact: true })).toHaveCount(0);
  expect(state.contentPuts).toHaveLength(1);
});

test("参考作品を「参考」の印つきで開き、投稿用コピー無しで読んで続きの話へ進む", async ({
  page,
}) => {
  await mockGitHub(page);
  await page.goto("./");
  const item = page.locator("ul.works li", { hasText: "潮見の道" });
  await expect(item.locator(".tag")).toHaveText("参考");
  await item.getByRole("link", { name: "潮見の道" }).click();
  await page.getByRole("link", { name: "第1話" }).click();

  await expect(page.getByText("ミオは言い切った。")).toBeVisible();
  await expect(page.getByRole("button", { name: "投稿用にコピー" })).toHaveCount(0);
  await page.getByRole("button", { name: "縦書き" }).click();
  await expect(page.locator(".text.vertical")).toBeVisible();

  await page.getByRole("link", { name: "続きの話へ(第2話)" }).click();
  await expect(page).toHaveURL(new RegExp(`#/r/${REFERENCE_NCODE}/e/2$`));
  await expect(page.getByText("ミオは港へ下りた。")).toBeVisible();
  await expect(page.getByRole("link", { name: /続きの話へ/ })).toHaveCount(0);
});

test("ノッチの無い画面では、safe-area の分の余白を足さない", async ({ page }) => {
  await mockGitHub(page);
  await page.goto("./#/pulls");
  await page.getByRole("button", { name: /第3話 灯を消す/ }).click();
  await page.getByText("嵐が来た。").click();
  const expectPadding = async (selector: string, padding: string) => {
    await expect(page.locator(selector).first()).toHaveCSS("padding", padding);
  };
  await expectPadding("header", "8px 16px");
  await expectPadding("main", "0px 16px 96px");
  await expectPadding(".composer", "8px 16px");
  await expect(page.locator(".pr-bar")).toHaveCSS("top", "0px");
  const notchBand = await page.evaluate<string>(
    'getComputedStyle(document.body, "::before").height',
  );
  expect(notchBand).toBe("0px");
});
