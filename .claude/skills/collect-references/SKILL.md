---
name: collect-references
description: 他作品収集ルーティンの手順。`references/works.csv` に登録した作品の未取得の話をなろうから取り、データリポジトリの `references/` に溜める。1 回の実行で最大 1000 話・50 分。
argument-hint: "[--max-episodes N] [--max-minutes M](省略時は 1000 話・50 分)"
---

# collect-references

設計は `docs/design/01-data-repo.md`(置き場所)と `docs/design/05-writing-loop.md`(ルーティン)。
取得は `scripts/narou/` が行う。このスキルは回して、結果をデータリポジトリに commit するだけ。

## 守ること

- 取得作法は CLAUDE.md のとおり: **2.5 秒/リクエスト・全年齢のみ(api.syosetu の novelapi と ncode.syosetu)・既取得は取り直さない**。
  間隔・全年齢・既取得の判定はスクリプトが守る。並行に回さない(このスキルを同時に 2 つ走らせない)。
- 取った本文は private のデータリポジトリ(`novel-atlas-data`)にだけ置く。novel-atlas(public)・Issue・PR・コメントに本文を書かない。再配布しない。
- 解析(分析メモ)はしない。なろう以外のサイトは取らない。

## 1 回の上限

- 取る話は **1 回 1000 話まで**(`--max-episodes`)。2.5 秒/話で約 42 分。
- 時間は **1 回 50 分まで**(`--max-minutes`)。超えたら新しいリクエストを送らずに終える。外側の `timeout` は 65 分。
- 取得元が 429 / 503 を返したら、その回はそこで止める(次の回に続きを取る)。

## 0. 準備

```sh
A=/home/user/novel-atlas; D=/home/user/novel-atlas-data
git -C $A checkout -q main && git -C $A pull -q --rebase origin main
pnpm --dir $A install --frozen-lockfile
test -d $D || git clone -q https://github.com/Hirayama61/novel-atlas-data $D
git -C $D checkout -q main && git -C $D pull -q --rebase origin main
```

`$D` が無く clone できなければ、`add_repo`(owner: Hirayama61, repo: novel-atlas-data, access: push)で接続してから clone する。
`$D/references/works.csv` が無いか、作品の行が無ければ「登録された作品はありません」と報告して終える。

## 1. 取る

```sh
DATA_DIR=$D timeout 65m pnpm --dir $A -s collect-references
```

- 作品ごとに 1 行(`<ncode> <状態> <置いた話>/<話数> [理由]`)と、この回に取った話数・打ち切りの理由が出る。
- 状態は `完了`・`途中`(上限で打ち切り、または消えた話がある)・`失敗`・`未着手`(打ち切りで回らなかった)。
- 失敗した作品は `references/<ncode>/fetch-log.csv` に理由が残り、次の作品へ進む。スクリプトが止まった(終了コードが 0 でない)ときは commit せず、エラーの要約を報告して終える。

## 2. 書いたものを確かめる

```sh
git -C $D status --porcelain | grep -v ' references/' || true
```

- 変わったのが `references/` の下だけであること。ほかが出たら commit せず、報告して終える。
- 書くのは `references/<ncode>/episodes/<NNN>.md`(本文)・`references/<ncode>/meta.json`(作品情報。毎回取り直す)・`references/<ncode>/fetch-log.csv`(失敗の記録)・`references/fetch-state.json`(進捗)だけ。

## 3. commit と push

変更が無ければ commit しない。

```sh
git -C $D add references
git -C $D commit -q -m "chore(references): 参考作品の本文を取得(<取った話数> 話)"
git -C $D push -q origin main
```

push が先行の変更で弾かれたら `git -C $D pull -q --rebase origin main` してから push し直す。

## 4. 報告

この回に取った話数、`完了` / `途中` / `失敗` の作品数、打ち切りの理由を 1〜3 行で。
`失敗` が 2 回続いた作品(`fetch-log.csv` に前回の日付の失敗がある)は、ncode と理由を添える。本文は報告に書かない。
