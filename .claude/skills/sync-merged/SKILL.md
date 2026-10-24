---
name: sync-merged
description: マージ後同期ルーティンの手順。マージ済み(= 確定稿)で synced の無い話の PR について、canon の昇格・声と嗜好の蒸留・申し送り・採点・観点遡及・index.json を済ませる。1 回の実行で 1 PR。
argument-hint: "[PR 番号](省略時は自動で選ぶ)"
---

# sync-merged

確定稿を直さない。点が落ちても本文は直さず、次話の設計(申し送り)で取り返す。

## 0. 準備

`write-episode` の 0 と同じ。作業は `main` 上で行う。

## 1. PR を選ぶ

```sh
gh api "$R/pulls?state=closed&per_page=30" --jq '.[] | select(.merged_at != null) | select([.labels[].name] | index("synced") | not) | "#\(.number) \(.head.ref) \(.merged_at)"'
```

ブランチ名が `ep/<作品>/<NNN>` のものを、マージの古い順に 1 件。無ければ「同期するものはありません」で終える。

## 2. canon

- その話の claims に出た事実のうち、canon で `status: 仮` のものを `確定` に上げ、`since` と `sources`(最終稿の引用)を合わせる。本文に出たものは戻せないため。
- claims の `names` で `resolves_to: null` のまま残ったものは、canon に足す(新しい人物・場所。status 仮でよい)。
- design.yaml の threads の plant / advance / payoff を `canon/threads.yaml` の `events` に足す。
- design.yaml の `status` を `published` にし、`title.final` を確定する(未定なら本文の見出しから)。

## 3. 声と嗜好

- claims の `speakers` から、各キャラの台詞の語尾を全話で集計し、`voice.established.endings` を更新する。
- `feedback/<NNN>.yaml` の `voice:<id>` の項目(採用・依頼者決定)を、そのキャラの `voice.notes` に `evidence: [feedback ID]` つきで足す。
- `praise` の項目を `craft/preferences.md` の末尾に「## 追加学習(YYYY-MM-DD・<作品> 第N話)」として足す(依頼者の言葉をそのまま引く)。

## 4. 申し送り・採点・遡及

- `handoff.yaml`: この話で消化した項目を `consumed`(resolved_in)に。内部レビュー・下読み・採点の落ち込みのうち次話で取り返すものを、`target: N+1` の `open` で足す。
- 採点(確定稿で回し直す。PR 中の採点は初稿基準のため): `run-isolated.sh scorer` を 2 回と `codex-scorer` を 1 回(案 C への倒し方は write-episode と同じ)。`scores/episodes.json` に既存の形式で記録する(話の型は design の `position.role`)。5 話ごと・章末は通しも回して `scores/overall.json` に。
- 観点遡及: この話で `ledger.yaml` に増えた規則それぞれについて、過去話への反映要否を判断し、`feedback/<NNN>.yaml` の `retro` に記録する。反映するなら「通し改稿」の Issue をデータリポジトリに起案する(本文は直さない)。

## 5. 仕上げ

1. `DATA_DIR=$D pnpm --dir $A -s check-data` がエラー 0 であること。
2. `DATA_DIR=$D pnpm --dir $A -s build-index`。
3. commit(`chore(<作品>): 第N話のマージ後同期`)して `main` に push。
4. PR に `synced` を付け、1 コメント(採点の要約・足した申し送り・遡及の判断)+ `<!-- atlas:bot -->`。

## 6. 報告

PR 番号・採点の要約・足した申し送りの件数を 1〜3 行で。
