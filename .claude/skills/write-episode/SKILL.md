---
name: write-episode
description: 執筆ルーティンの手順。承認済みの話設計書 PR に初稿を書くか、次話の話設計書 PR を開く。1 回の実行で 1 件だけ扱う。ルーティン「novel-atlas 執筆」と対話セッションの両方がこの手順で動く。
argument-hint: "[作品 ID] [話数](省略時は自動で選ぶ)"
---

# write-episode

1 回の実行で扱うのは 1 件。終わったら次を拾わずに報告して終える。
設計は `docs/design/05-writing-loop.md`。ここに無い判断に迷ったらそれを読む。

## 0. 準備

```sh
A=/home/user/novel-atlas; D=/home/user/novel-atlas-data
git -C $A checkout -q main && git -C $A pull -q --rebase origin main
pnpm --dir $A install --frozen-lockfile
test -d $D || git clone -q https://github.com/Hirayama61/novel-atlas-data $D
git -C $D checkout -q main && git -C $D pull -q --rebase origin main
R=repos/Hirayama61/novel-atlas-data
```

- GitHub の操作は `gh api`(REST)。`gh pr` / `gh issue` は使わない。
- ルーティンが書くコメント・PR 本文の末尾には必ず `<!-- atlas:bot -->` を付ける(依頼者のコメントと区別する印)。
- **`design-approved` ラベルを付けない。** 付けてよいのは依頼者だけ。
- 本文・設定は private のデータリポジトリにだけ書く。novel-atlas(public)には書かない。

## 1. 拾うものを決める

```sh
gh api "$R/pulls?state=open&per_page=50" --jq '.[] | "#\(.number) \(.head.ref) [\([.labels[].name]|join(","))]"'
```

優先順:

1. `design-approved` が付き、`stage:design` のままで `busy` が無い PR → **3. 初稿**。
2. `stage:design` か `stage:reading` で依頼者の未処理コメントがある PR → 何もしない(コメント反映ルーティンの仕事)。
3. 作品ごとに、開いている話の PR の数が `work.yaml` の `schedule.wip_limit` 未満で、`status` が 連載中 の作品 → **2. 設計 PR を開く**(次の話数 = 確定済みの最大の話 + 1)。
   `cadence: weekly` なら、前話のマージから 5 日以上たっていること(前話のマージ日は `gh api "$R/pulls?state=closed&per_page=20"` の `merged_at`)。
4. どれも無ければ「扱うものはありません」と報告して終える。

`busy` が付いた PR は触らない。扱い始めたら `busy` を付け、終わったら外す:
`gh api -X POST "$R/issues/$N/labels" -f 'labels[]=busy'` / `gh api -X DELETE "$R/issues/$N/labels/busy"`

## 2. 設計 PR を開く

1. ブランチ `ep/<作品>/<NNN>` を作る。
2. 読む: `CLAUDE.md`、`$D/craft/*.md`(preferences・style-norms・story-principles・glossary)、`$D/works/<作品>/charter.md`・`arcs.yaml`・`handoff.yaml`・`canon/*`、直近 3 話の `text.md` と `design.yaml`、直近の `feedback/*.yaml`(依頼者の好み・指摘の傾向)。
3. `$D/works/<作品>/episodes/<NNN>/design.yaml` を書く(スキーマは `$A/src/core/schema/episode.ts`、説明は `$A/docs/design/04-episode-design-schema.md`)。
   - `handoff.yaml` の、この話を `target` にした `open` の項目をすべて `handoff_in` で扱う(consume / defer / drop と理由)。
   - `type.label` は直近 2 話と変える。`type.breaks` で、直近と同じビートにしないための崩し方を書く。
   - この話で新しく必要な canon の項目(人物・場所・出来事・伏線・知識)は、canon のファイルに `status: 仮` で足す。
4. 検査: `DATA_DIR=$D pnpm --dir $A -s check-data --work <作品> --episode <N> --only schema,design,canon`。エラーが 0 になるまで直す。
5. `story-consistency-reviewer` に設計を見せる(作品 ID・話数・DATA のパス・対象 = 設計)。指摘を三角分けして反映し、却下したものは `rejected` に理由つきで書く。
6. commit(`feat(<作品>): 第N話の話設計書`)して push し、PR を作る:
   ```sh
   gh api -X POST "$R/pulls" -f title="[<作品>] 第N話 <title.working>" -f head="ep/<作品>/<NNN>" -f base=main -F body=@<本文ファイル>
   gh api -X POST "$R/issues/<PR番号>/labels" -f 'labels[]=stage:design'
   ```
   本文(5 行以内+印): 章と山のどこか / 話の型 / 判断を仰ぎたい分岐(あれば 2 案を短く)/ 「承認はビューアの『設計を承認』か `design-approved` ラベル」/ `<!-- atlas:bot -->`。

## 3. 初稿

1. `stage:design` を外して `stage:drafting` を付ける。ブランチを checkout して pull。
2. `episode-writer` を起動する。渡すもの: 作品 ID・話数・DATA のパス。返ってきた「設計の各欄の実現箇所」を控える。
   メインは本文を書かない(書いた本人でない目で検品するため)。
3. `extract-claims` の手順で claims.yaml を作る。
4. 検査: `DATA_DIR=$D pnpm --dir $A -s check-data --work <作品> --episode <N>`。エラーはメインが本文を直して消す(設計を変えるなら 04 の「承認のゲート」の範囲だけ)。本文を直したら claims を抽出し直す。
5. 内部レビューを **並列で** 起動する(1 メッセージで複数):
   - `story-consistency-reviewer`(対象 = 本文)
   - `prose-reviewer`(本文のパス)
   - `punctuation-reviewer`(本文のパス)
   - `recurrence-reviewer`(本文のパス)
   - 読者体験(隔離): `DATA_DIR=$D bash $A/scripts/run-isolated.sh reader <作品> <N> /tmp/reader.md ep/<作品>/<NNN>`。
     終了コード 3(隔離プロセスを起動できない)なら、隔離バンドルを `pnpm isolate` で作り、`reader-experience-reviewer` サブエージェントにバンドルのパスだけを渡して「バンドル外を読むな」と指示する。どちらで走らせたかを記録する。
     隔離レビュアーへの指示に、設計・意図・経緯を書かない(話数とバンドルの場所だけ)。
6. 指摘を三角分けする: 複数のレビュアーが重なる指摘・明確な規則違反は即適用。割れる指摘はメインが判断し、迷うものは採らずに PR 本文の「判断が割れたもの」に書く。却下した指摘は `design.yaml` の `rejected` に理由つきで(source: `reviewer:<名前>`)。
7. 4〜6 を最大 3 巡。3 巡目でも重大な指摘が残るなら、`needs-input` を付けて PR にその旨をコメントし、`busy` を外して終える。
8. 確定直前に、下読みと採点を隔離で回す(`run-isolated.sh slush` と、`scorer` を 2 回+`codex-scorer` 1 回。案 C への倒し方は 5 と同じ)。
   下読みの重大指摘のうち保留相当のものだけ対応する(巡数は増やさない)。採点でどれかの観点が 1 点なら `needs-input` を付けて止める。
   レビューの要約と採点を `$D/works/<作品>/feedback/<NNN>.yaml` の `reviews` に書く(episode・pr・rounds: 0・items: [] で作る)。
9. commit(`feat(<作品>): 第N話 初稿(内部レビュー N 巡)`)して push。
   必須チェックが緑になるのを確かめる: `gh api "$R/commits/<sha>/check-runs" --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'`(数分待って再確認。赤なら直して 4 へ)。
   Codex の自動レビューのコメント(`chatgpt-codex-connector[bot]`)が来ていれば、コメント反映と同じ扱いで処理してから進める。
10. `stage:drafting` を外して `stage:reading` を付ける。PR 本文の冒頭を書き換える(5 行以内+印): 読む所要時間の目安 / 前話からの流れ / 内部レビューで判断が割れたもの / 採点の要約。
11. `busy` を外す。

## 4. 報告

扱った作品・話数・PR 番号、結果(設計 PR を開いた / 初稿を上げた / needs-input / 扱うもの無し)、巡数、隔離をどの方式で走らせたかを 1〜4 行で。
