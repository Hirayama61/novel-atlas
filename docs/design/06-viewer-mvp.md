# 06. ビューア MVP

`novel-atlas` の PWA。shogi-atlas と同じ構成(React + Vite + Dexie + vite-plugin-pwa、GitHub Pages、ハッシュルーティング)。
ビルド成果物には本文も設定も入らない。端末が PAT でデータリポジトリを読み、IndexedDB に置く。

## 設定と同期

- 設定画面で Fine-grained PAT を入れる。対象は `novel-atlas-data` だけ。
  権限: `Contents: Read`、`Pull requests: Read and write`、`Metadata: Read`。
  ラベルの付け外し(`design-approved`)に `Issues: write` が要るかは未確認で、1 段目で確かめる。
- 設定画面のシートから本体リポジトリ(`Hirayama61/novel-atlas`)に `ready` 付きの改善 Issue を作れる。同じ PAT に `novel-atlas` の `Issues: Read and write` を足す。下書きは端末に残し、送れたときだけ消す。
- トークンの保存は shogi-atlas の `src/sync/github.ts` と同じ(「記憶する」なら localStorage、しないなら sessionStorage)。
  書き込み権限を持つトークンになるので、外部スクリプトを読まない CSP を入れる。
- 同期は Git Trees API(`GET /repos/{o}/{r}/git/trees/{ref}?recursive=1`)で全ファイルの SHA を取り、SHA が変わったファイルだけ Contents API で取る。
  shogi-atlas の `index.json` 方式より 1 リクエスト少なく、ファイル単位の差分が取れる。
- 同期対象は `works/**` と `references/works.csv`、`references/*/meta.json`、`references/*/episodes/**`、`references/*/analysis/**`。
  **他作品の本文(`references/*/episodes/**`)も同期し、端末の IndexedDB に置いて読書画面で読む。**
  本文が置かれるのは private のデータリポジトリと端末の IndexedDB だけで、ビルド成果物と公開リポジトリには入れない。
  ビルド成果物に本文が入らないことはテストで確かめる(07 の 3 段目)。
- ブランチを切り替えると、そのブランチの tree で同じ処理をする。ブランチごとに別のストアに置き、`main` を汚さない。

## 画面

### 作品・話の一覧

- 自作と他作品を同じ一覧に出す(他作品は「参考」の印)。
- 話の一覧に状態を出す: 確定済み / PR の段階(`stage:*` ラベル)/ 未読コメントの有無。
- 字数・採点(話別の平均)を列に出す。
- ライブラリの先頭に「あなたの番」を出す: open の話の PR のうち、返答待ち(`needs-input`)・設計の承認待ち(`stage:design` で `design-approved` 無し)・読む番(`stage:reading`)を「作品名 第N話 やること」の 1 行で並べ、タップで読書画面(設計段階なら設計書)を開く。該当が無ければ節ごと出さない。判定は `src/core/turn.ts`。

### 読書

- 本文は `text.md` を行(= 文)単位で描く。空行は段落の区切り、「◇」は場面転換として描く。
- **縦書き切替**: `writing-mode: vertical-rl`。縦書きでは半角の `!?` を縦中横(`text-combine-upright`)にし、ダッシュ・三点リーダーを縦向きのグリフで出す。
- **ルビ**: なろう記法を解釈する。`｜親文字《るび》` と、漢字の直後の `《るび》`。傍点 `《《語》》` も扱う。
  漢字直後の丸括弧をルビにするなろうの自動判定は、既定で切る(本文の括弧書きを誤ってルビにしないため)。
- **字詰め**: 1 行の字数と文字サイズを設定で選ぶ。横書きは `max-width: <字数>em`、縦書きは `height` で決める。行間も選べる。
- **読了位置**: 画面内の先頭の文の行番号を話ごとに保存し(IntersectionObserver)、開いたらそこへ戻る。PR のブランチでも保存する。
- **投稿用にコピー**: 見出し行(`# `)・了行・行頭の全角空白を除いた本文をクリップボードに入れ、字数を表示する。旧手順の perl 変換を置き換える。

### PR タブ

- `GET /repos/{o}/{r}/pulls?state=open` で開いている PR を一覧にし、ラベル(段階)・巡数・未処理コメント数を出す。
- PR を選ぶとブランチを切り替え、その話の `text.md` と `design.yaml` を読書画面で開く。
- `design.yaml` は欄ごとに整形して描く(あらすじは場面単位、キャストは表、伏線は canon の題名つき)。
- **段落の選択とコメント**:
  1. 文をタップで選び、続けてタップで範囲を伸ばす(段落ごと選ぶボタンもある)。
  2. コメントを書くと下書きとして IndexedDB に溜まる。読み進めながら何件でも書ける。
  3. 読み終えたら「まとめて送る」。`POST /repos/{o}/{r}/pulls/{n}/reviews` に `event: COMMENT` と全件の `comments`(`path`・`line`・`start_line`・`side: RIGHT`・`body`)を載せ、1 件のレビューとして送る。
     1 件だけ送るときは `POST /repos/{o}/{r}/pulls/{n}/comments`(`commit_id` は PR の head SHA、`path`、`line`、範囲なら `start_line`)。
  4. 本文には選んだ文の引用と、隠し印 `<!-- atlas:{"ep":7,"lines":[118,120],"blob":"<SHA>"} -->` を添える。
     ルーティンが push して行がずれても、引用と blob SHA から元の位置を引ける。
- 話のファイルが PR で新規追加なら全行が diff に入るので、どの行にもコメントできる。
  確定済みの話を直す PR(通し改稿)では変更の無い行に行コメントを付けられないので、`subject_type: file` のファイルコメントに引用つきで送る。
- 既存のコメントを本文の横に出す(`GET /repos/{o}/{r}/pulls/{n}/comments`)。ルーティンの返信(`atlas:bot` 印)と、リアクション(🚀 採用・👀 却下/保留)を表示する。
- `stage:design` の PR に「設計を承認」ボタンを置き、`design-approved` ラベルを付ける(`POST /repos/{o}/{r}/issues/{n}/labels`)。
- マージは MVP では GitHub の画面で行う(08 の Q4)。ビューアには PR への外部リンクを置く。
- 他作品の話も同じ読書画面で開く(縦書き・ルビ・字詰め・読了位置は自作と同じ)。続きの話へ 1 タップで進める。
  投稿用コピーと PR タブは他作品に出さない。他作品の本文の表示は 3 段目で入れる(07)。

### 設定資料集・時系列表

- **キャラ**: profile・attributes・relations・voice を 1 画面に。`status` を色で分ける(確定 / 仮)。
  出典の引用をタップすると本文のその行へ飛ぶ。
  「全台詞」タブ(claims の `speakers` から)と「指摘の履歴」タブ(`feedback` の `voice:<id>`)を置く。
- **知識表**: 行 = キャラ、列 = 話、セル = その話の時点で知っている事実の数。セルを開くと一覧。誤信(`belief`)は別色。
- **時系列表**: timeline の出来事を話の順に並べ、カレンダー別の日付と相対関係(「数日後」)を併記する。回想(`flashback`)は印を付ける。
- **伏線**: threads を表にし、撒き・進行・回収の話を横軸に並べる。`reveal.not_before` と `obligations.due` を目盛りとして出す。
- **法則**: rules をそのまま整形して出す。
- 他作品の解析結果は同じスキーマなので、同じ画面で描く。他作品でも出典の引用は同期した本文のその行へのリンクにする。

## MVP に入れないもの

- ビューアからのマージ、canon の編集、話設計書の編集(すべて PR とルーティン経由)。
- 採点の推移グラフ(2 段目)。
- オフラインでのコメント送信の再送キュー(送信失敗は下書きに残すだけ)。
