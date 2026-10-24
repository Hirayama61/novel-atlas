# 05. 執筆ループ

1 話 = 1 本の PR。
ブランチは `ep/<作品>/<NNN>`、PR の題は `[<作品>] 第N話 <作業中の題>`。
状態は PR のラベルで表す。マージが確定稿になる。

## PR の状態遷移

```text
             執筆ルーティン                依頼者              執筆ルーティン
 (前話マージ)──────────▶ stage:design ──design-approved──▶ stage:drafting
                          ▲    │ 依頼者のコメント                  │ 初稿 → CI → 内部レビュー → 改稿(最大 3 巡)
                          │    ▼                                    ▼
                          └ コメント反映ルーティン          stage:reading ◀─────────┐
                                                               │ 依頼者がビューアで読み、│
                                                               │ 段落にコメントして送る  │
                                                               ▼                        │
                                                         stage:revising ── 反映・CI・隔離再検査 ┘
                                                               │
                                                     依頼者がマージ(= 確定稿)
                                                               ▼
                                                    マージ後同期ルーティン → synced
```

| ラベル | 意味 | 付ける者 |
| --- | --- | --- |
| `stage:design` | 話設計書のレビュー中 | 執筆ルーティン |
| `design-approved` | 設計承認(ゲート) | **依頼者だけ** |
| `stage:drafting` | 初稿と内部レビューの最中。依頼者は読まなくてよい | 執筆ルーティン |
| `stage:reading` | CI が緑で内部レビューが済んだ。依頼者が読む番 | 執筆ルーティン |
| `stage:revising` | 依頼者のコメントを反映中 | コメント反映ルーティン |
| `busy` | ルーティンが作業中(二重起動の防止。6 時間更新が無ければ見守りが外す) | 各ルーティン |
| `needs-input` | 依頼者の判断待ち(割れる指摘・赤信号) | 各ルーティン |
| `synced` | マージ後同期が済んだ | マージ後同期ルーティン |

- 承認を GitHub の Approve でなくラベルにするのは、PR を開くのがルーティン(依頼者のトークン)で、作者本人は自分の PR を Approve できないため。
  ルーティンは `design-approved` を付けない。付けた者を GitHub 上で区別できない(同じアカウント)ので、スキルの禁止事項として書く。
- `stage:reading` は「依頼者が読む価値のある稿になった」という合図。
  ここに上げる条件をスキルでなく判定で決める: 必須チェック(`lint`・`canon`・`design`)が緑、内部レビューの未処理の指摘がゼロ、隔離レビュアーの重大指摘が処理済み。
- 1 作品で同時に開く話の PR は `work.yaml` の `wip_limit`(既定 1)まで。前話の確定稿を前提に次の設計を書くため。

## ルーティン一覧

すべて claude.ai の Routines 画面から作り、`novel-atlas` と `novel-atlas-data` を接続した新しいセッションで起動する。
プロンプトは「`/<スキル名>` を読んで実行せよ」だけにする。

| ルーティン | 間隔(案) | スキル | やること |
| --- | --- | --- | --- |
| novel-atlas 執筆 | 1 時間おき | `/write-episode` | 下の「執筆」 |
| novel-atlas コメント反映 | 1 時間おき(執筆と 30 分ずらす) | `/apply-feedback` | 下の「コメント反映」 |
| novel-atlas マージ後同期 | 1 日 2 回 | `/sync-merged` | 下の「マージ後同期」 |
| novel-atlas 他作品収集 | 1 日 1 回 | `/collect-references` | なろうから未取得の話を取る(2.5 秒/リクエスト・全年齢のみ・既取得は取らない)。1 回 50 分まで、外側の `timeout` 65 分 |
| novel-atlas 他作品解析 | 1 日 1 回 | `/analyze-references` | 取得済みの話を 20 話ずつ claims 形式で抽出し、`references/<ncode>/analysis/` を更新 |
| novel-atlas 見守り | 毎朝 | `/monitor-routines` | 下の「見守り」 |
| novel-atlas Issue 作業 | 1 時間おき | `/work-issue` | `novel-atlas` 本体の `ready` Issue を 1 件(shogi-atlas と同じ) |

各ルーティンは 1 回の実行で 1 件だけ扱い、終わったら次を拾わずに報告して終える(shogi-atlas の `/work-issue` と同じ)。
急ぐときは依頼者が Routines 画面から手動実行する。

### 執筆(`/write-episode`)

優先順に 1 件だけ拾う。

1. `design-approved` が付き `stage:design` のままの PR → 初稿へ進む。
2. `stage:design` で、依頼者の未処理コメントがある PR → コメント反映ルーティンに任せて飛ばす。
3. `wip_limit` に空きがあり、`schedule` 上で次話が来ている作品 → 設計 PR を開く。

設計 PR を開く手順:

- 入力: `craft/*`、`charter.md`、canon 全体、`arcs.yaml`、`handoff.yaml`、直近 3 話の本文と `design.yaml`、`feedback/` の直近の蒸留結果。
- `design.yaml` を書き、新しく必要な canon 項目を `status: 仮` で足す。
- `pnpm design-check` を通し、`story-consistency-reviewer` に設計を見せて指摘を反映する。
- push して `stage:design` を付け、PR 本文に「章と山のどこか」「判断を仰ぎたい分岐(あれば 2 案)」を書く。

初稿の手順:

1. `stage:drafting` に付け替える。
2. 執筆用サブエージェント(`episode-writer`)に、承認済みの `design.yaml`・craft・charter・直近 3 話を渡して本文を書かせる。
   メインは書かずに検品する。旧 Phase A の「書いた本人でない目で見る」を tmux drive の代わりにサブエージェントで行う。
3. claims を抽出し、`pnpm check-episode`(lint・canon・design の実現)を回す。失敗はメインが直す。
4. 内部レビューを並列で起動する(下の「レビュアー」)。指摘を三角分けして反映する。
5. 3〜4 を最大 3 巡。3 巡目でも重大指摘が残れば `needs-input` を付けて依頼者に上げる。
6. 確定直前に下読みと採点を隔離バンドルで回す(下の「隔離」)。赤信号(どれかの観点で 1 点)なら `needs-input`。
7. push、必須チェックが緑になったのを `gh api .../commits/<sha>/check-runs` で確かめ、`stage:reading` に付け替える。
   PR 本文の冒頭に「読む所要時間・前話からの変更点・内部レビューで割れた判断」を 5 行以内で書く。

### コメント反映(`/apply-feedback`)

対象: `stage:design` か `stage:reading` で、依頼者の未処理コメントがある PR。

「未処理」の定義:

- ルーティンの返信は依頼者と同じアカウントから出る。本文末尾の `<!-- atlas:bot -->` で区別する。印の無いコメントが依頼者のもの。
- 処理済みのコメントにはルーティンが 🚀(採用)か 👀(却下・保留)のリアクションを付ける(`POST /repos/{o}/{r}/pulls/comments/{id}/reactions`)。リアクションの無い依頼者コメントが未処理。
- スレッドの resolve は GraphQL でしかできないので使わない。

手順(1 回の実行で、その PR の未処理コメントを全部 1 バッチとして扱う):

1. `stage:revising` と `busy` を付ける。
2. **規則を先に立てる。**
   各コメントを分類する(`vocab` / `voice:<キャラ>` / `punctuation` / `structure` / `canon` / `praise` / `taste`)。
   `vocab` は `vocab.tsv` に、規則化できるものは `ledger.yaml` に、修正より前に 1 行足す。
   `feedback/NNN.yaml` に全件を書く。CI は「`vocab` に分類した項目に対応する辞書行があるか」を見るので、この順を飛ばすと落ちる。
3. **修正。** 指摘箇所だけを直す。割れる指摘は直さず、理由を返信に書いて `needs-input` を付ける。
4. **台詞への指摘は実績で裏取りする。**
   claims の `speakers` からそのキャラの全台詞を集め、声テーブルでなく実績に合わせる。
5. **機械検査。** claims を抽出し直し、`pnpm check-episode` を通す。失敗はこの段で直す。
6. **修正起因の擦れを見る。** 変更した行の前後 5 行を `prose-reviewer` と `recurrence-reviewer` に渡す(修正文が新しい違反の主な発生源だった)。
7. push し、各コメントに返信する: 「採用: 何をどう直したか(変更後の文)」か「却下: 理由」。リアクションを付ける。
8. `stage:reading` に戻し、PR に「今回の反映: N 件(採用 a・却下 b・保留 c)、巡数 r」を 1 コメントで書く。

巡数に上限は置かない(終わりは依頼者がマージで決める)。
代わりに巡数と「依頼者が初めて見つけた機械検出可能な指摘」の件数を見守りが毎朝数え、運用ログに出す。
後者が 1 件でもあれば、その指摘を検出する規則を足す Issue を見守りが起案する。

### マージ後同期(`/sync-merged`)

対象: マージ済みで `synced` の無い話の PR。

- canon: その話で本文に出た `仮` 項目を `確定` に上げ、`sources` を最終稿の引用に合わせる。
- 声: claims の `speakers` から語尾を集計し、`voice.established` を更新する。`feedback` の `voice:*` を `voice.notes` に足す。
- 嗜好: `feedback` の `praise` を `craft/preferences.md` の追加学習節に日付つきで足す。
- 申し送り: 内部レビュー・下読み・採点の落ち込みを `handoff.yaml` に次話を `target` にして足す。消化した項目を `consumed` にする。
- 採点: 確定稿を隔離バンドルで採点し、`scores/episodes.json` に記録する。点が落ちても本文は直さない。節目(5 話ごと・章末)は通しも回す。
- 観点遡及: その話で増えた規則(`ledger.yaml` の新項目)について、過去話への反映要否を判断し、`feedback/NNN.yaml` の `retro` に記録する。反映するなら通し改稿の Issue をデータリポジトリに起案する。
- `index.json` を作り直し、`main` に commit・push して PR に `synced` を付ける。

投稿は自動化しない(なろう・カクヨムに投稿 API は無く、依頼者が手で行う)。
ビューアに「投稿用にコピー」ボタンを置き、見出し行・了行・行頭の全角空白を除いた本文をクリップボードに入れる(06)。

### 見守り(`/monitor-routines`)

shogi-atlas の手順を引き継ぎ、次を足す。

- `busy` のまま 6 時間更新の無い PR からラベルを外す。
- `design-approved` から 3 時間たっても `stage:drafting` にならない、依頼者のコメントから 3 時間たっても未処理のまま、を異常とする。
- 他作品収集の進捗(`fetch-state.json`)と、取得失敗(`fetch-log.csv`)の増加。
- データリポジトリの Actions の失敗と、`schedule` 実行が紛れ込んでいないか。
- 運用ログはデータリポジトリの Issue「運用ログ」(ラベル `ops`)に書く。
  `novel-atlas` は public なので、話数や題名を含むログを置かない。

## Actions で止めるもの

データリポジトリの `.github/workflows/check.yml`。PR の push ごとに走る。
`novel-atlas` を public のまま checkout してスクリプトを実行する(トークン不要)。

| チェック名 | 内容 | 必須 |
| --- | --- | --- |
| `schema` | canon・design・claims・feedback の YAML 検証 | 必須 |
| `design` | 04 の設計段階の検査 | 必須 |
| `lint` | 句読点(S4・FRAG)・要注意語・textlint・`ledger.yaml` のパターン規則・`lint-allow.yaml` の理由 | 必須(`stage:design` では本文が無いので通る) |
| `canon` | 03 の照合と、04 の本文段階の検査 | 必須 |
| `feedback` | `vocab` 分類の項目に辞書行がある、全コメントが `feedback/NNN.yaml` にある | 必須 |
| `gate` | 承認後に設計部が変わったら `design-approved` を外す | — |

- `main` へのマージはブランチ保護で必須チェックの緑を条件にする(依頼者もこれを越えてマージしない)。
- 1 回の実行は 1〜2 分の見込み。1 話で 30 push しても 60 分で、private の無料枠(月 2,000 分)に収まる。
- 抽出(LLM)は Actions で行わない。API キーを置かず、ルーティンの抽出し忘れは `canon` の鮮度検査で落ちる。

## レビュアー

`novel-atlas/.claude/agents/` に置く。作品の中身を含まず、作品固有の基準は charter と canon を読んで得る。

| レビュアー | 入力 | 隔離 | 起動 |
| --- | --- | --- | --- |
| `story-consistency-reviewer` | canon・design・全話(claims を先に読み、要る話だけ本文を読む) | なし | 設計時・初稿の各巡 |
| `prose-reviewer` | 対象話・規範・charter | 設計情報を渡さない(指示による) | 初稿の各巡・反映時の差分 |
| `punctuation-reviewer` | 対象話・lint 結果 | 同上 | 初稿の各巡(C2・TTE の分類だけ。S4 等は CI が落とす) |
| `recurrence-reviewer` | 対象話・`ledger.yaml`(パターン化できない規則だけ) | 同上 | 初稿の各巡・反映時の差分 |
| `reader-experience-reviewer` | 隔離バンドル | 物理的に隔離 | 初稿の 1 巡目 |
| `slush-reader-reviewer` | 隔離バンドル | 物理的に隔離 | 確定直前 |
| `rubric-scorer` ×2 | 隔離バンドル+ルーブリック | 物理的に隔離 | 確定直前・マージ後 |
| Codex(GitHub 自動レビュー) | PR の diff とリポジトリ | 08 の Q1 | push ごと(自動) |
| Codex(`codex exec`) | 隔離バンドル | 物理的に隔離 | 採点の 3 件目・第三者の読み |

## Codex レビューの位置

- Codex の GitHub 連携を `novel-atlas-data` で有効にし、PR の自動レビューに入れる。
  レビュー指針はデータリポジトリ直下の `AGENTS.md` の「Review guidelines」に書く(canon との矛盾・設計からの逸脱・日本語の誤りを優先、好みの指摘は書かない)。
- Codex のコメントは `chatgpt-codex-connector[bot]` から付く。依頼者のコメントと同じ扱いで `feedback/` に記録するが、依頼者が読む前に執筆ルーティンが処理する。
  `stage:reading` に上げる条件に「Codex の未処理コメントがゼロ」を含める。
- **隔離の問題。** 話設計書と初稿が同じ PR にあるので、Codex の自動レビューは設計情報と canon を見たうえで本文を読む。
  旧環境の Codex は「公開本文+作風意図のみ」の隔離レビュアーだった。
  この設計では、自動レビューを「設計を知っている第三者の整合レビュー」として使い、隔離された Codex の読みは `codex exec` で隔離バンドルに対して行う案を推す(08 の Q1)。
- Codex の自動レビューが散文の PR でどの程度の指摘を出すかは未確認。1 段目で第 7 話の設計 PR に対して試し、出力を見てから位置を確定する。

## 隔離レビュアーへの情報遮断

公開/封印のディレクトリを無くすので、隔離は「渡す物を作る」方式にする。

1. `pnpm isolate --work <作品> --upto <N> --ref <ブランチ> --out <一時ディレクトリ>` が隔離バンドルを作る。
   中身は第 1 話〜第 N 話の `text.md` と、役割ごとに許すチェックリストの節(読者体験 = レビュー観点 C 節、下読み = D 節、採点 = ルーブリック)だけ。
   コピーは許可リスト方式で、canon・design・claims・feedback・charter・craft の他の文書は入らない。
   `scripts/isolate.test.ts` が「許可リスト外のファイルが 1 つも入らない」ことを固定する。
2. 隔離レビュアーは、そのバンドルだけが見える状態で起動する。
   - 案 A: ルーティンのセッションから `claude -p` を別プロセスで起動し、作業ディレクトリをバンドルにして、`--settings` でバンドル外の Read を拒否する。
   - 案 B: GitHub Actions でバンドルだけを成果物として渡し、Claude Code Action / Codex を実行する(API キーと Actions 時間が要る)。
   - 案 C: 同じセッションのサブエージェントに、バンドルのパスだけを渡して「バンドル外を読むな」と指示する(旧環境と同じ。物理的な遮断は無い)。
   案 A を推す。ルーティンの環境で `claude -p` と `codex exec` が動くかは未確認で、1 段目の最初に確かめる(08 の Q2)。
3. 隔離レビュアーの出力はメインが読み、`feedback/NNN.yaml` の `reviews` に要約を残す。
   出力にネタバレが混じる心配は無くなった(依頼者は全部読む体制)ので、旧 A7(防火壁の最終チェック)は「投稿本文に canon の `hidden` が出ていないか」だけに縮める。
   これは `sealed_terms` の照合で機械的に決まる。

## PR コメントの蓄積と再利用

`feedback/NNN.yaml`(話ごと、マージ後も残す):

```yaml
episode: 7
pr: 12
rounds: 4
items:
  - id: feedback.007.15
    source: owner               # owner / codex / reviewer:<名前> / legacy-log
    comment_id: 1234567890
    round: 2
    path: works/lighthouse/episodes/007/text.md
    lines: [118, 120]
    quote: 父さんには灯は見えてない
    body: 父に向かってこの言い方はきつすぎる。もっと遠回しに
    tags: [voice:mio]
    decision: 採用               # 採用 / 却下 / 保留 / 依頼者決定
    reason: null
    change: { before: …, after: … }
    rule_ref: works.lighthouse.ledger.R-112   # 規則化した先
    created_at: 2026-11-02T10:12:00Z
reviews:
  - reviewer: reader-experience-reviewer
    round: 1
    summary: …
retro:                          # 観点遡及の判断
  - rule: R-112
    decision: 遡及しない
    why: 過去話に同型の台詞が無い
```

再利用の経路:

- **口調**: `voice:*` → `characters/<id>.yaml` の `voice.notes`(根拠の feedback ID つき)。
  ビューアのキャラ画面に「そのキャラへの指摘の履歴」と「全台詞」を並べ、口調を詰めるときの資料にする。
- **語彙・句読点**: `vocab` / `punctuation` → `vocab.tsv` と `ledger.yaml`。以後は CI が止める。
- **嗜好**: `praise` / `taste` → `craft/preferences.md`。テーマ生成・設計の羅針盤に入る。
- **設計の癖**: `structure` → `handoff.yaml` と、話設計書の CI 規則の候補(同じ構造指摘が 2 話で出たら規則化の Issue)。
- 第 4〜6 話の旧指摘ログも同じ形式に変換するので、移行直後から過去の指摘を引ける(02 の手順 6)。
