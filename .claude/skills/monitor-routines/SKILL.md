---
name: monitor-routines
description: novel-atlas の自動化(執筆・コメント反映・マージ後同期の各ルーティン、データリポジトリの Actions、PR の滞留)を点検し、止まっているものを直し、結果をデータリポジトリの Issue「運用ログ」に記録する。毎朝のルーティンが使う。
---

# monitor-routines

人はルーティンのセッションを見ない前提。異常の検知と一次対応までをここで済ませ、人の判断が要ることだけを運用ログで知らせる。
GitHub の操作は `gh api`(REST)。ルーティンの操作は `mcp__claude-code-remote__*`(list_triggers / get_session / list_events / fire_trigger)。
運用ログは**データリポジトリ**(private)に書く。novel-atlas は public なので、話数・題名・本文を含むことを書かない。

```sh
R=repos/Hirayama61/novel-atlas-data; A=repos/Hirayama61/novel-atlas
```

## 1. 点検

### a. ルーティン

`list_triggers` で「novel-atlas 執筆」「novel-atlas コメント反映」「novel-atlas マージ後同期」「novel-atlas 見守り」「novel-atlas Issue 作業」を確認する。
`enabled`、`last_run.status`(FAILED は異常)、直近の結果文(`list_events` kinds: result)を見る。

### b. PR の滞留

```sh
gh api "$R/pulls?state=open&per_page=50" --jq '.[] | "#\(.number) [\([.labels[].name]|join(","))] updated \(.updated_at)"'
```

- `busy` のまま 6 時間更新が無い → 放置。`busy` を外し、PR にその旨をコメント(印 `<!-- atlas:bot -->`)。
- `design-approved` から 3 時間たっても `stage:drafting` にならない → 異常(執筆ルーティンを `fire_trigger`)。
- 依頼者のコメントから 3 時間たっても未処理(🚀/👀 が無い)→ 異常(コメント反映ルーティンを `fire_trigger`)。
- マージ済みで `synced` の無い PR が 1 日以上 → 異常(マージ後同期を `fire_trigger`)。
- `needs-input` は人の判断待ち。運用ログに列挙する(催促しない)。

### c. 依頼者が初めて見つけた指摘

直近 24 時間に追記された `works/*/feedback/*.yaml` の `source: owner` の項目のうち、tags が `vocab` / `punctuation` / `layout` のもの(機械で検出できる種類)を数える。
1 件でもあれば、その指摘を検出する規則(vocab・ledger の pattern・lint)が足されたかを確かめ、足されていなければ novel-atlas に `ready` の Issue を起案する(本文に話数・引用を書かず、「語彙の指摘が辞書に入っていない」のように抽象化する)。

### d. Actions

```sh
gh api "$R/actions/runs?per_page=20" --jq '.workflow_runs[] | "\(.created_at) \(.name) [\(.event)] \(.conclusion)"'
gh api "$A/actions/runs?branch=main&per_page=5" --jq '.workflow_runs[] | "\(.created_at) \(.name) \(.conclusion)"'
```

- データリポジトリに `schedule` の実行があれば異常(定期処理を Actions に載せない)。
- novel-atlas の main の CI か Deploy が failure なら `ready` の Issue を起案する。

## 2. 運用ログ

データリポジトリの Issue「運用ログ」(ラベル `ops`)に 1 コメント。無ければ作る(本文「毎朝の点検結果を見守りルーティンがコメントする」)。

```
## YYYY-MM-DD 点検
- ルーティン: 正常 / 異常(…)
- PR: 読む番 N 本 / 反映待ち N / needs-input: #.. (無ければ「なし」)
- 依頼者が初めて見つけた機械検出可能な指摘: N 件(対応: …)
- 対応したこと: …(無ければ「なし」)
```

異常が無ければ 3 行。最後に書いた内容をそのまま報告して終える。
