# 01. novel-atlas-data のディレクトリ構成

private リポジトリ。
自作の全作品、共通の craft 文書、他作品の本文キャッシュと解析結果、採点台帳、PR コメントの蓄積を置く。
パスは ASCII にする案で書く(理由と代案は 08 の Q3)。中身の日本語はそのまま。

```text
README.md                      運用の説明(shogi-atlas-data の README と同じ役割)
AGENTS.md                      Codex の自動レビュー向けの指示(05 参照)
index.json                     ビューア用の軽量索引(自動生成。手で触らない)

craft/                         共通層(全作品に効く)
  preferences.md               嗜好プロファイル
  style-norms.md               日本語表現規範
  story-principles.md          物語設計原則(§1 の話設計書テンプレは schema に移り、本文から外す)
  review-checklist.md          レビュー観点(A〜D 節)
  rubric.md                    採点ルーブリック(版番号つき)
  rejected-themes.md           没案アーカイブ
  ledger.yaml                  再発防止規則のうち作品に依らないもの(旧・指摘台帳の共通部分)
  lint/
    vocab.tsv                  共通の要注意語(旧・要注意語.tsv の共通部分)
    textlint.json              textlint の規則設定

works/
  hoshiyomi/                   作品 ID(ASCII)。1 作品 = 1 ディレクトリ
    work.yaml                  題名・掲載先(なろう ncode / カクヨム)・連載状態・章の一覧・既定の字数
    charter.md                 作風憲章(固有層。声テーブルは canon/characters へ移す)
    arcs.yaml                  章構成(章のテーマ・各話スケッチ・章末の型)
    handoff.yaml               申し送り(次話以降への課題。項目ごとに消化状態を持つ)
    ledger.yaml                再発防止規則のうち作品固有のもの
    lint/
      vocab.tsv                作品固有の要注意語
    canon/                     設定資料(03 のスキーマ)
      characters/<id>.yaml     1 人 1 ファイル
      timeline.yaml            出来事と時間関係
      threads.yaml             伏線(撒き・進行・回収)
      rules.yaml               世界の法則・異能・描写の防衛線
      places.yaml              場所
      premise.yaml             作品の核(一行・約束・大域の謎・結末方向)
    episodes/
      001/
        text.md                本文(1 行 1 文。見出し行と「(第N話 了)」を含む現行の書式)
        design.yaml            話設計書(04 のスキーマ)
        claims.yaml            本文から抽出した事実(自動生成。03 参照)
        lint-allow.yaml        lint の意図的例外(行の引用・規則・理由)
      002/ ...
    editions/<id>.md           版の方針(現行版の書き直し方針など。話設計書より上の層)
    archive/
      editions/<id>/           旧版(本文・話設計書・採点・申し送り・canon の写し)。照合・ルーティン・一覧の対象外
      rejected/                没案
    feedback/
      001.yaml ...             PR コメントの構造化記録(話ごと)
    scores/
      episodes.json            話別スコア台帳
      overall.json             通しスコア台帳
  <次の作品>/                   同じ構成

references/                    他作品
  works.csv                    シード(ncode・題名・既刊巻数・注記)。旧 novel-analytics/data/works.csv
  <ncode>/
    meta.json                  なろう API のメタ(毎回取り直す)
    episodes/<n>.txt           本文キャッシュ(取得済みは再取得しない)
    fetch-log.csv              取得失敗の記録
    analysis/                  自作と同じスキーマ(characters/ timeline.yaml threads.yaml)+ stats.json
  fetch-state.json             収集ルーティンの進捗
  analysis-state.json          解析ルーティンの進捗

ops/
  routines.md                  ルーティンの一覧と接続先(見守りが参照する)
```

## 決めたことと理由

- **自作は `works/<作品 ID>/` で並べる。**
  作品ごとにリポジトリを作らない(依頼者の決定 2)。
  ルーティン・CI・ビューアは `works/*` を走査するので、作品を足すときはディレクトリを作るだけで済む。
- **1 話 = 1 ディレクトリ。**
  本文・設計書・claims・lint 例外が同じ PR で同時に変わるため、まとめて置く。
  話番号は 3 桁ゼロ詰め(`007`)。題名はファイル名に入れず `design.yaml` の `title` に持つ。
  題名の変更でパスが変わらないので、PR の行コメントとビューアの読了位置が切れない。
- **本文は Markdown のまま、1 行 1 文の書式を守る。**
  PR の行コメントの `line` がそのまま「文」を指す。
  字下げ・空行・「◇」の書式は日本語表現規範 §4 のとおり。ルビはなろう記法(`｜親文字《るび》`)で書く。
- **`公開/`・`封印/` は無くす。**
  話設計書は話のディレクトリへ、設定は `canon/` へ移す。
  隔離は置き場所でなく「隔離バンドル」で行う(05)。
- **craft 文書は散文の Markdown のまま残す。**
  YAML 化の対象は、照合に使う事実(canon・話設計書・再発防止規則・申し送り)に限る。
  嗜好プロファイルや規範は人間と LLM が読む文章なので、構造化しても照合に使わない。
- **共通層と作品固有層をディレクトリで分ける。**
  旧リポジトリでは文書冒頭の「共通/固有」の注記で分けていた。
  指摘台帳・要注意語は共通と固有が 1 ファイルに混在していたので、移行時に振り分ける(02)。
- **生成物は手で触らない。**
  `index.json`・`claims.yaml`・`feedback/*.yaml`・`scores/*.json` はスクリプトかルーティンが書く。
  旧 `shogi-atlas-data` の `inbox-state.json` と同じ扱い。
- **他作品の本文は `references/<ncode>/episodes/` に置き、ビルド成果物には出さない。**
  ビューアは解析結果だけを同期対象にし、本文は同期しない(06)。
  HTML の生データ(旧 `cache/<ncode>/<n>.raw.html`)は置かない。
  抽出器を直したときの再抽出用だったが、7 作で 143MB あり、本文テキストだけで解析には足りる。

## work.yaml の例

```yaml
id: hoshiyomi
title: 星詠みのセロ
status: 連載中            # 構想中 / 連載中 / 休載 / 完結
publish:
  - site: narou
    ncode: null           # 移行時に埋める
  - site: kakuyomu
    url: null
schedule:
  cadence: weekly         # 執筆ルーティンが次話の設計 PR を開く間隔の目安
  wip_limit: 1            # 同時に開いておく話の PR の数(08 の Q6)
length:
  target_chars: 8000
  range: [6000, 10000]
chapters:
  - no: 1
    title: 星詠みのセロ
    episodes: [1, 12]
```

## 版(2026-10-24 追加)

作品を第 1 話から書き直すときは版を切る。`work.yaml` の `editions` に版を並べ、`status: current` をちょうど 1 つにする。

- 現行版の話は `works/<作品>/episodes/` に置く。旧版は `works/<作品>/archive/editions/<id>/` に、本文・話設計書・採点・申し送り・canon の写しごと移す。
- スキーマの読み込み(`src/core/data/`)は `archive/` を読まないので、照合 CI・ルーティン・ビューアの一覧は現行版だけを見る。ビューアは `archive/` を同期しない。
- 版の方針は `works/<作品>/editions/<id>.md` に書き、`editions[].doc` から指す。
- canon の事実は「背骨」と「本文」に分け(03 の `basis`)、旧版の本文で成り立っていた事実は 仮 に戻す。
- 1 話の字数は `work.yaml` の `length.target_chars` と `length.max_chars` が持つ。CI は話設計書の `budget.total` と本文の字数が `max_chars` を超えたら落とす。

