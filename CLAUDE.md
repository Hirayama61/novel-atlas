# novel-atlas

自分用の小説アトラス。連載小説の執筆ループ(話設計書 → 初稿 → 依頼者のコメント → 反映 → 確定)を回す検査スクリプトと、読書・コメント・設定資料の PWA。
GitHub Pages で公開し、スマホにインストールして使う。設計は `docs/design/` が正。

## 絶対に守ること

- **本文・設定・craft 文書をこのリポジトリにコミットしない。** 自作も他作品も。実データは非公開の `Hirayama61/novel-atlas-data` に置く。
  テストのフィクスチャ(`src/core/__tests__/fixtures.ts` の架空の作品「灯台守の娘」)だけが例外。実在の作品の設定や本文の断片を例に使わない。
  この PWA は公開サイトなので、ビルド成果物に本文が混ざると公衆送信になる。
- **このリポジトリは public。** コミットメッセージ・Issue・PR・コメントにも、未公開の設定(根幹・伏線の答え・結末・話設計書の中身)を書かない。運用ログはデータリポジトリの Issue に書く。
- **なろうの取得は 2.5 秒/リクエスト・全年齢のみ(api.syosetu / ncode.syosetu)・既取得は取り直さない。** 取得した本文は再配布しない。
- **なろう・カクヨムへの投稿を自動化しない。** 投稿は依頼者が手で行う(ビューアの「投稿用にコピー」)。
- **`design-approved` ラベルをルーティンが付けない。** 付けてよいのは依頼者だけ(同じアカウントなので GitHub 上で区別できない。約束で守る)。
- トークンや秘密情報をコードに埋めない。依存を足したら `node_modules/<pkg>/package.json` の `license` を見て、GPL 系や不明なものは Issue に書いて人の判断を仰ぐ。

## 構成

- `src/core/schema/` zod スキーマ。canon(characters・timeline・threads・rules・places・premise)、話設計書(design)、claims、lint-allow、work・arcs・handoff・ledger・feedback。`pnpm schemas` で `schemas/*.schema.json` を書き出す。
- `src/core/data/` データリポジトリのファイル一覧(パス → 中身)を、スキーマで検証しながら作品ごとのデータに組み立てる。ブラウザと scripts の両方が使う。
- `src/core/check/` 照合。`canon.ts`(参照・出典・封印語・表記・防衛線・伏線)、`design.ts`(話設計書の欄・型の反復・知識・異能・字数・申し送り、本文での実現)、`lint.ts`(句読点・要注意語・パターン規則・feedback)。
- `src/core/lint/punctuation.ts` 旧 `check.pl` の移植。判定を変えたら既存話で件数を比べる。
- `src/core/isolate.ts` 隔離バンドル。許可リスト方式で、本文と役割ごとのチェックリストの節だけを入れる。許可を足すときはテスト(`isolate.test.ts`)も直す。
- `src/core/ruby.ts`(なろう記法)、`posting.ts`(投稿用の本文)、`comment.ts`(PR コメントの引用と隠し印)、`index-file.ts`(`index.json`)。
- `src/sync/` GitHub REST。Git Trees + blobs で同期、PR のレビュー送信・ラベル。`src/db/` Dexie。`src/ui/` 画面(ハッシュルーティング)。
- `scripts/` `check-data`・`isolate`・`build-index`・`export-schemas`。`DATA_DIR` にデータリポジトリの clone を渡す。
- `.claude/skills/` ルーティンと対話の手順。`.claude/agents/` レビュアーと執筆役(作品の中身を含まない。作品固有の基準は charter と canon を読んで得る)。

## コマンド

```
pnpm dev          # 開発サーバー
pnpm check        # typecheck + lint + format:check + test
pnpm build && pnpm e2e   # Playwright。GitHub API はモック(e2e/fixture.ts)
DATA_DIR=... pnpm check-data [--only schema,design,lint,canon,feedback] [--work <id>] [--episode <N>]
DATA_DIR=... pnpm isolate --work <id> --upto <N> --role <reader|slush|scorer|codex> --out <空のディレクトリ> [--ref <ブランチ>]
DATA_DIR=... pnpm build-index
pnpm schemas
```

変更したら `pnpm check` を通してからコミットする。画面や同期に触ったら `pnpm build && pnpm e2e` も。CI は両方走る。
検査の判定を変えたら、データリポジトリの clone に `pnpm check-data` を流し、既存話に新しいエラーが出ないことを確かめる。

## 執筆ループ

1 話 = データリポジトリの 1 PR(ブランチ `ep/<作品>/<NNN>`)。状態はラベル(`stage:design` → `design-approved` → `stage:drafting` → `stage:reading` ⇄ `stage:revising` → マージ → `synced`)。詳細は `docs/design/05-writing-loop.md`。

- 執筆: `/write-episode`。コメント反映: `/apply-feedback`。マージ後同期: `/sync-merged`。見守り: `/monitor-routines`。
- ルーティンは claude.ai の Routines 画面から作る(本体とデータリポジトリが接続された新しいセッションで起動する)。プロンプトは「`/<スキル名>` を読んで実行せよ」だけにし、手順はスキルに書く。
- 作業セッションにはデータリポジトリの clone が `/home/user/novel-atlas-data` にある。無ければ `add_repo`(owner: Hirayama61, repo: novel-atlas-data, access: push)で接続してから clone する。
- 定期処理をデータリポジトリの Actions に載せない(private の無料枠を消費する)。Actions は PR ごとの検査(`check.yml`)だけ。

## 開発の流れ

- 要望はこのリポジトリの Issue にする。公開リポジトリなので、未公開の設定は書かない (上の「絶対に守ること」)。
- クラウドの開発ループは `ready` の Issue だけを扱う。Issue 1 件につきブランチ `claude/issue-<番号>` と PR 1 本。
- レビュー係が `approved` を付け、CI (check) が通ると automerge がマージする。人が止めたいときは PR に `hold` を付ける。
- GitHub の操作は `gh api` (REST) で行う。`gh issue ...` / `gh pr ...` は GraphQL を使うためクラウドの環境では失敗する。
- `pnpm check`、`pnpm build` が通らない変更は出さない。画面や同期に触ったら `pnpm build && pnpm e2e` も通す。

レビューと修正の基準は `.claude/skills/polaris-dev/reference/review-criteria.md` にある。`AGENTS.md` は Codex の PR レビュー専用。

## ラベル

| ラベル       | 意味                                      |
| ------------ | ----------------------------------------- |
| `ready`      | 整理済み。開発ループが実装してよい        |
| `needs-info` | 質問中。答えは Issue のコメントに書く     |
| `split`      | 小さな Issue に分割した元。閉じるのは人   |
| `hold`       | 人の判断待ち。ループは触らない            |
| `human`      | 人がやる Issue。ループは触らない          |
| `approved`   | (PR) レビュー係が承認した                 |
| `needs-fix`  | (PR) レビューの指摘あり。開発ループが直す |

領域ラベル (`area:*`) は残してよいが、ループは見ない。
