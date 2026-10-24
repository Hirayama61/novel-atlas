# 02. novel-hoshiyomi からの移行

`novel-hoshiyomi` の履歴(79 コミット)を保ったまま `novel-atlas-data` の `works/hoshiyomi/` 以下へ移す。
散文から YAML への変換は、移動とは別のコミットにする。
`git log --follow` で移動前の履歴を追え、変換で何が落ちたかを diff で確かめられる。

## マッピング

### 本文

| 現在 | 移行先 |
| --- | --- |
| `公開/本編/第1章_星詠みのセロ/第00N話_<題>.md` | `works/hoshiyomi/episodes/00N/text.md`(題名は `design.yaml` の `title` へ) |
| `公開/本編/第1章_星詠みのセロ/旧版_opus48/*.md` | `works/hoshiyomi/archive/opus48/00N.md` |
| `docs/craft/没案_第003話_短縮版.md` | `works/hoshiyomi/archive/rejected/003-short.md` |

### 話設計書

| 現在 | 移行先 |
| --- | --- |
| `封印/話設計書/第00N話*.md` の設計部 | `episodes/00N/design.yaml`(04 のスキーマに変換) |
| 同・ステータス節 | 捨てる(状態は PR とラベルが持つ。完了話は `status: published`) |
| 同・却下節 | `design.yaml` の `rejected` |
| 同・指摘ログ節 | `feedback/00N.yaml`(1 指摘 = 1 項目。`source: legacy-log`) |
| 同・Phase A 作業ログ | `feedback/00N.yaml` の `reviews`(レビュアー別の要約) |
| `封印/話設計書/申し送り.md` | `handoff.yaml`(項目ごとに `target`・`status: open/consumed/kept`) |
| `封印/話設計書/第00N話_改稿v2.md`(第 1〜3 話) | 通し改稿の設計として `episodes/00N/design.yaml` の `revisions` へ |

### canon(散文 → YAML)

| 現在 | 移行先 |
| --- | --- |
| `封印/年表.md` 背骨・本編確定の時系列 | `canon/timeline.yaml` |
| 同・地理メモ | `canon/places.yaml` |
| `封印/伏線台帳.md` | `canon/threads.yaml`(F 番号を `id` に保つ) |
| `封印/キャラ根幹.md` | `canon/characters/<id>.yaml` の `core` |
| `公開/登場人物.md` | 同 `profile`(見た目・性格・口調) |
| `docs/craft/作風憲章.md` 声テーブル | 同 `voice` |
| `封印/異能仕様.md` | `canon/rules.yaml`(発動条件・不発条件・ズレの種類・自覚段階) |
| `封印/根幹.md` 防衛線(種族・運) | `canon/rules.yaml` の `constraints` |
| `封印/根幹.md` 一行・異能の出自・大域の謎・結末方向・世界の広がり | `canon/premise.yaml` |
| `封印/章構成.md` | `arcs.yaml` |
| `公開/世界観.md`・`公開/テーマ.md` | `premise.yaml` の `surface`(読者に見せてよい表層) |
| `公開/README.md` | 捨てる(防火壁の説明) |

### craft 文書(共通層 / 固有層)

| 現在 | 層 | 移行先 |
| --- | --- | --- |
| `docs/craft/嗜好プロファイル.md` | 共通 | `craft/preferences.md` |
| `docs/craft/日本語表現規範.md` | 共通 | `craft/style-norms.md` |
| `docs/craft/物語設計原則.md` | 共通 | `craft/story-principles.md`(§1 テンプレは `design.yaml` スキーマへ移し、本文は参照に置き換える) |
| `docs/craft/レビュー観点.md` | 共通 | `craft/review-checklist.md` |
| `docs/craft/採点ルーブリック.md` | 共通 | `craft/rubric.md` |
| `docs/craft/没案アーカイブ.md` | 共通 | `craft/rejected-themes.md` |
| `docs/craft/作風憲章.md`(声テーブル以外) | 固有 | `works/hoshiyomi/charter.md` |
| `.claude/skills/recurrence-check/指摘台帳.md` | 混在 | 句読点・語彙の一般則 → `craft/ledger.yaml`、キャラの声・この作品の語 → `works/hoshiyomi/ledger.yaml` |
| `.claude/skills/punctuation-sweep/要注意語.tsv` | 混在 | 一般語(辻・じゃなし等)→ `craft/lint/vocab.tsv`、世界観由来(握り飯→パン、帳面→手帳等)→ `works/hoshiyomi/lint/vocab.tsv` |
| `CONTEXT.md` | 共通 | `craft/glossary.md`(防火壁・公開資料・封印資料の項を削り、隔離バンドル等を足す) |
| `README.md` | — | `works/hoshiyomi/` の内容は `work.yaml` へ。運用の説明は捨てる |

### 採点

| 現在 | 移行先 |
| --- | --- |
| `評価/話別スコア.json` | `works/hoshiyomi/scores/episodes.json`(形式は維持) |
| `評価/通しスコア.json` | `works/hoshiyomi/scores/overall.json` |

### 仕組み(コード・エージェント・スキル)

データリポジトリには移さない。`novel-atlas` 本体で作り直す(05)。

| 現在 | 扱い |
| --- | --- |
| `.claude/agents/*.md`(7 体) | `novel-atlas/.claude/agents/` に作品非依存の形で書き直す。「セロの語りの声」のような固有の記述は charter 参照に置き換える |
| `.claude/skills/write-episode/SKILL.md` | 廃止。執筆・コメント反映・マージ後同期の 3 スキルに分ける |
| `.claude/skills/punctuation-sweep/check.pl` | `novel-atlas/src/core/lint/punctuation.ts` に移植。Actions とビューアで同じ判定を使う |
| `.claude/skills/score-novel/SKILL.md` | `novel-atlas/.claude/skills/score-episode/` に書き直す(隔離バンドル経由) |
| `.claude/skills/recurrence-check/SKILL.md` | 機械検査できる規則は CI へ、残りは `recurrence-reviewer` が `ledger.yaml` を読む |
| `.claude/settings.json` | 捨てる |

### リポジトリ外

| 現在 | 扱い |
| --- | --- |
| `~/obsidian/brain/Decisions/novel-project/` | 08 の Q10 |
| `novel-analytics/cache/`(7 作・143MB) | 本文テキスト(`<n>.body.txt`)と `meta.json` だけを `references/<ncode>/` へ取り込む。ネットワークを使わない |
| `novel-analytics/data/works.csv` | `references/works.csv` |
| `novel-analytics/src/*.py` | 取得作法を `novel-atlas/scripts/narou/` に移植したのち、リポジトリを archive にする(08 の Q11) |

## 手順

1. **事前確認。**
   `novel-hoshiyomi` に未コミットの変更が無いこと、`origin/main` と一致することを確かめる(2026-10-24 時点で一致)。
2. **履歴を書き換えたコピーを作る。**
   `novel-hoshiyomi` を新しい場所へ clone し、`git filter-repo` の `--filename-callback` でパスを移す。
   本文は `公開/本編/第1章_星詠みのセロ/第00N話_*.md` → `works/hoshiyomi/episodes/00N/text.md` のように、ファイル名から話番号を取って写像する。
   それ以外は上の表の移行先へ写す。ただし形式変換が要るもの(話設計書・封印資料)は、この段階では `works/hoshiyomi/legacy/` に元の名前のまま置く。
   旧版_opus48 の本文には題名が入るので、その時点の題名は変換用の対応表に控える。
3. **`novel-atlas-data` に取り込む。**
   `gh repo create Hirayama61/novel-atlas-data --private` で空のリポジトリを作る。
   README・`craft/` の骨格を最初のコミットにし、手順 2 の履歴を `git merge --allow-unrelated-histories` で合わせる。
   これで `git log --follow works/hoshiyomi/episodes/006/text.md` が第 6 話の 18 巡の履歴まで遡れる。
4. **変換コミット。**
   `legacy/` の散文を YAML へ変換する。1 ファイルの種類ごとに 1 コミット(timeline・threads・characters・rules・premise・arcs・handoff・各話 design)。
   変換は Claude が行い、各コミットの本文に「落とした情報」と「`仮` にした項目」を列挙する。
   変換し終えた `legacy/` のファイルは消す(履歴には残る)。
5. **照合で検証する。**
   変換した canon に対して既存 6 話の claims を抽出し、照合 CI を流す。
   公開済みの本文と `確定` 項目の食い違いがゼロになるまで、canon 側を直す(本文は直さない)。
   残った食い違いは依頼者に一覧で見せ、本文の誤りとして扱うかを決めてもらう。
6. **指摘ログの構造化。**
   第 4〜6 話の指摘ログを `feedback/00N.yaml` に変換する。
   旧ログの「→採用 / →却下 / →台帳 R-NN」の注記を `decision` と `rule_ref` に写す。
   第 6 話だけで百件を超えるので、ここは 2 段目に回してもよい(1 段目では `legacy/` に原文を残す)。
7. **旧リポジトリを止める。**
   `novel-hoshiyomi` の README の冒頭に移行先を書いてコミットし、GitHub で archive にする(読み取り専用。削除しない)。
   ここだけが `novel-hoshiyomi` への変更になる。依頼者の承認を得てから行う。

## 変換で注意すること

- 年表の年代は粗いまま移す。「約 300 年前」を数値の年にしない(03 の時間表現)。
- 伏線台帳の「回収方向(柔軟)」「温存」は `status: 仮` と `reveal` の制約に写す。散文の候補は `options` に箇条書きで残す。
- 声テーブルと実績が食い違う場合は実績が正(`write-episode` の 2026-08-01 の教訓)。
  移行時に各キャラの全台詞から語尾を集計し、表に無い実績を `voice.established` に足す。
- 指摘台帳の `[維持]` 項目は、レビュアーに再指摘させないための記録なので落とさない。
