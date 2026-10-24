---
name: apply-feedback
description: コメント反映ルーティンの手順。依頼者(と Codex)の未処理の PR コメントを 1 バッチとして反映し、各コメントに返信する。1 回の実行で 1 PR。ルーティン「novel-atlas コメント反映」と対話セッションの両方がこの手順で動く。
argument-hint: "[PR 番号](省略時は自動で選ぶ)"
---

# apply-feedback

依頼者が初回の検出係にならないことが目的。手順を飛ばした分だけ、次の巡で依頼者が同じ種類の指摘を見つけることになる。

## 0. 準備

`write-episode` の 0 と同じ(clone・pull・`R=repos/Hirayama61/novel-atlas-data`・`<!-- atlas:bot -->` の印・`design-approved` を付けない)。

## 1. PR を選ぶ

```sh
gh api "$R/pulls?state=open&per_page=50" --jq '.[] | select([.labels[].name] | index("busy") | not) | "#\(.number) [\([.labels[].name]|join(","))]"'
gh api "$R/pulls/$N/comments?per_page=100" --jq '.[] | {id, user: .user.login, type: .user.type, line, start_line, original_line, path, body, rocket: .reactions.rocket, eyes: .reactions.eyes, in_reply_to_id}'
```

- 未処理 = 本文に `<!-- atlas:bot -->` が無く、🚀 も 👀 も付いていないコメント(返信 `in_reply_to_id` も含む)。Codex(`chatgpt-codex-connector[bot]`)のコメントも対象。
- PR の会話コメント(`gh api "$R/issues/$N/comments"`)も同じ規則で見る。
- 未処理があり、`busy` の無い PR のうち、最も古いコメントを持つものを 1 件選ぶ。無ければ「未処理のコメントはありません」で終える。
- `stage:design` の PR なら、本文の代わりに `design.yaml` を直す(以下の手順のうち 2・3・7・8 だけ)。

## 2. 着手

`busy` と `stage:revising` を付け、`stage:reading` を外す。ブランチを checkout して pull。

## 3. 記録と規則を先に立てる(修正より前)

1. 各コメントの位置を確かめる: 本文の隠し印 `<!-- atlas:{"ep":..,"lines":[a,b],"blob":".."} -->` と引用(`> ` の行)から、今の本文のどの行かを決める(push で行がずれていても引用で探す)。
2. 分類する(複数可): `vocab` / `punctuation` / `layout` / `voice:<キャラ ID>` / `structure` / `canon` / `praise` / `taste`。
3. `vocab` のうち機械で拾える語は、`works/<作品>/lint/vocab.tsv`(作品固有)か `craft/lint/vocab.tsv`(一般語)に**先に** 1 行足し、`feedback` の項目に `vocab_pattern` として同じパターンを書く(CI がこの対応を確かめる)。
4. 別の話でも再発しうる規則は `ledger.yaml`(作品固有か craft)に 1 項目足す。機械で拾えるなら `check: pattern` と `pattern`。
5. `works/<作品>/feedback/<NNN>.yaml` に全件を書く(無ければ作る): id は `feedback.<NNN>.<連番>`、source は `owner` / `codex`、comment_id、round(この PR の反映巡数+1)、path・lines・quote・body・tags。decision は 5 の後で埋める。

## 4. 修正

- 指摘箇所だけを直す。指摘外を書き換えない。
- 依頼者が文言まで指定した修正は、その文言のとおりにする(レビュアーに蒸し返させない)。
- **台詞への指摘は実績で裏取りする**: claims の `speakers` からそのキャラの全台詞(過去話を含む)を集め、声テーブル(`voice`)でなく実績に合わせる。表と実績が食い違えば実績が正で、`voice` のほうを直す。裏取りできなければ直さず、返信で依頼者に判断を仰ぐ。
- 割れる指摘・依頼者の判断が要る指摘は直さず、decision を `保留` にして理由を返信に書く。
- 書いた行が「指摘への回答を読者に説明する講釈」になっていないかを見る。

## 5. 機械検査と隔離の再検査

1. `extract-claims` の手順で claims を抽出し直す。
2. `DATA_DIR=$D pnpm --dir $A -s check-data --work <作品> --episode <N>`。エラーをこの段で直す。
3. 変更した行の前後 5 行を `prose-reviewer` と `recurrence-reviewer` に**並列で**渡す(範囲指定)。この巡で足した規則が修正文に効いているかも見させる。指摘を反映する。
4. 構造に触れる大きな修正(場面の追加・削除・順序の入れ替え)をしたときだけ、`story-consistency-reviewer` も回す。

## 6. push と返信

1. commit(`fix(<作品>): 第N話 コメント反映 r<巡数>(採用 a・却下 b・保留 c)`)して push。必須チェックが緑になるのを確かめる。
2. 各コメントに返信する(`gh api -X POST "$R/pulls/$N/comments/<comment_id>/replies" -f body=...`):
   - 採用: `採用: <何をどう直したか>` と変更後の文(1〜3 行)
   - 却下: `却下: <理由>`
   - 保留: `保留: <依頼者に決めてほしいこと>`
     末尾に `<!-- atlas:bot -->`。
3. リアクションを付ける: 採用 = 🚀、却下・保留 = 👀。
   `gh api -X POST "$R/pulls/comments/<comment_id>/reactions" -f content=rocket`(`eyes`)
4. `feedback/<NNN>.yaml` の decision・reason・change・rule_ref を埋め、`rounds` を 1 増やして commit・push。

## 7. 状態を戻す

- `stage:revising` と `busy` を外し、`stage:reading`(設計 PR なら `stage:design`)を付ける。保留があれば `needs-input` も付ける。
- PR に 1 コメント: `今回の反映: N 件(採用 a・却下 b・保留 c)、巡数 r。足した規則: <vocab/ledger の ID>` + 印。

## 8. 報告

PR 番号・件数・巡数・足した規則を 1〜3 行で。
