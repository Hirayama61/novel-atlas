# 07. 段階計画

各段の終わりで依頼者に確認する。
1 段目だけで第 7 話から連載を再開できる区切りにする。

## 1 段目: 移行と、第 7 話を新しいループで書く

到達点: 第 7 話が「設計 PR → 承認 → 初稿 → 依頼者がビューアで読みコメント → 反映 → マージ」で確定し、投稿できる。

最初に確かめること(結果で設計を直す):

- ルーティンのセッションで `claude -p` を隔離ディレクトリで起動できるか、`codex exec` が使えるか(隔離の案 A)。
- Fine-grained PAT で PR へのレビュー送信とラベルの付け外しができる権限の組み合わせ。
- Codex の GitHub 自動レビューが散文の PR に何を出すか。

作るもの:

| 領域 | 内容 |
| --- | --- |
| リポジトリ | `novel-atlas`(public)と `novel-atlas-data`(private)を作る。ラベルを設定(ブランチ保護は無料プランの private リポジトリでは使えない。05 参照) |
| 移行 | 02 の手順 1〜5 と 7。指摘ログの構造化(手順 6)は 2 段目 |
| スキーマ | canon・design・feedback の zod スキーマと JSON Schema |
| CI | `schema`・`design`・`lint`(check.pl の移植・vocab・textlint)・`feedback`・`gate`。`canon` は「スキーマ・参照・出典・封印語・表記・固有名」まで |
| 隔離 | `pnpm isolate` とそのテスト。案 A が動けば案 A、動かなければ案 C で始めて 08 の Q2 に戻す |
| スキル | `/write-episode`・`/apply-feedback`・`/sync-merged`(canon の昇格・`index.json`・`feedback` の書き出し・採点まで)・`/monitor-routines` |
| エージェント | 7 体を作品非依存に書き直し、`episode-writer` を足す |
| ビューア | 同期・作品/話の一覧・読書(縦書き・ルビ・字詰め・読了位置・投稿用コピー)・PR タブ(コメントのまとめ送信・返信の表示・承認ボタン) |
| ルーティン | 執筆・コメント反映・マージ後同期・見守りを Routines 画面で作る |

1 段目では claims の抽出を「固有名・話者・伏線の言及・封印語」に絞る。
属性・知識・異能・時系列の照合は 2 段目で足す。それまでは `story-consistency-reviewer` が canon を読んで見る(旧環境と同じ)。

## 2 段目: 事実の照合と蓄積の再利用

到達点: 整合性の指摘の大半が CI で出て、レビュアーは意味の判断だけをする。

- claims の抽出を属性・知識・異能・時系列・設計の実現まで広げ、03 の判定表を全部入れる。
- 既存 6 話の claims を抽出し、canon との食い違いをゼロにする(移行の検証を厳密にやり直す)。
- 第 4〜6 話の旧指摘ログを `feedback/` に変換する。
- `voice.established` の自動集計、`voice.notes` への蒸留、キャラ画面の「全台詞」「指摘の履歴」。
- 設定資料集・知識表・時系列表・伏線表。採点の推移グラフ。
- 見守りに「依頼者が初めて見つけた機械検出可能な指摘」の集計と、規則化 Issue の起案を足す。

## 3 段目: 参考作品の登録・収集・読書・AI の参照

到達点: 作者が好きな作品をアプリで登録すると本文がデータリポジトリに溜まり、自作と同じ読書画面でスマホから読め、話設計のときに AI が参考に引ける。
小説は Polaris から切り離し、novel-atlas で完結させる(Polaris の `library/novel/` は廃止。01)。

1. 登録: ライブラリから小説家になろうの作品 URL か ncode を登録し、`references/works.csv` に 1 行足す。二度登録しない。一覧から外せる。
   PAT に `novel-atlas-data` の `Contents: Read and write` が要るので、08 の Q4 の権限の範囲を見直す。
2. 収集: `scripts/narou/` に取得作法(2.5 秒/リクエスト・全年齢のみ・既取得は取り直さない・`meta.json` は毎回取る)を書き、収集スキル `/collect-references` とそのルーティンを作る。
   本文は `references/<ncode>/episodes/`、作品情報は `references/<ncode>/meta.json` に置く。
   `novel-analytics/cache/` の本文もここに取り込む(ネットワークを使わない)。
3. 読書: 同期の対象に `references/*/episodes/**` と `references/*/meta.json` を足し、自作と同じ読書画面で読む(06)。
   ビルド成果物に本文が入らないことをテストで確かめる。
4. AI の参照: 話設計書の `references` 欄と、設計時に `references/` から参考になる箇所を引く手順を `/write-episode` に足す。
   本文を転記せず、構成の観察に留める。隔離レビュアーのバンドルに参考作品の本文が入らないことを `isolate.test.ts` で確かめる。

解析と統計は 4 つの後に回す。

- 解析ルーティン: 20 話ずつ claims 形式で抽出し、`references/<ncode>/analysis/` の characters・timeline・threads を育てる。
  他作品の解析結果はすべて `status: 仮` とし、出典は話番号と引用で持つ。
- 字数・会話量などの統計(旧 `novel-analytics` の T1・T2)を `stats.json` に。

## 4 段目: 複数連載

- 2 作目を `works/<id>/` に立てる(テーマ生成から。旧 CONTEXT.md の「パイロット先行」の手順をスキル化)。
- ルーティンが作品ごとの `schedule` と `wip_limit` で拾う順を決める。
- craft の共通層と固有層の分け方を、2 作目の立ち上げで見直す。
