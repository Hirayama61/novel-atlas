---
name: extract-claims
description: 1 話の本文から claims.yaml(本文が述べた事実)を抽出する手順。照合 CI の入力になる。write-episode と apply-feedback が本文を変えるたびに使う。
---

# extract-claims(prompt_version: 1)

本文が何を述べたかを YAML に抜き出す。**判定はしない**(canon と合うかどうかは CI が決める)。
抽出は 1 話ぶんの本文と canon の ID 一覧だけを入力にする。全話を読まない。

## 入力

- `DATA/works/<作品>/episodes/<NNN>/text.md`
- ID の一覧: `canon/characters/*.yaml` の `id`・`name`・`aliases`、`canon/places.yaml` の `id`・`name`・`aliases`、`canon/threads.yaml` の `id`・`title`、`canon/rules.yaml` の abilities の `trigger`/`no_trigger` の kinds、各キャラの `knowledge[].fact`
- 設計: 同じ話の `design.yaml`(design_realization を作るため)

## 出力: `DATA/works/<作品>/episodes/<NNN>/claims.yaml`

```yaml
text_sha: <git -C DATA hash-object works/<作品>/episodes/<NNN>/text.md の値>
extractor: { model: <自分のモデル名>, prompt_version: 1 }
speakers: [{ line: <台詞の行番号>, who: <キャラ ID か、モブなら null> }]   # 「」で始まる行すべて
names: [{ quote: <本文に出た固有名・呼び名>, resolves_to: <キャラか場所の ID、未登録なら null> }]  # 1 つの呼び名につき 1 件
threads: [{ id: <伏線 ID>, kind: plant|advance|payoff|echo, quote: <本文の引用> }]
knowledge_use: [{ who: <キャラ ID>, fact: <事実 ID>, quote: <その事実を知っている前提で話す・動く箇所> }]
ability_use: [{ who: <キャラ ID>, quote: <発話>, kind: <trigger/no_trigger の語>, fired: <発動したか>, drift: <字面|解釈|主体|規模|時機 か null> }]
design_realization: [{ item: 'showpieces[0]', quote: <本文の引用> }, { item: 'texture[1]', quote: ... }]
# 2 段目で使う欄(1 段目は空でよい): facts, events, time_markers
```

## 規則

- `quote` は本文の部分文字列を**そのままコピー**する(1 行の中の 8〜40 字。行頭の全角空白は含めない)。言い換えない。CI は引用が本文に無ければ落とす。
- `speakers` は台詞の行を漏らさない。話者が文脈で決まらないときは null(推測で埋めない)。
- `ability_use` は、その作品の異能の持ち主が言い切った・願った・問うた発話のうち、異能の判定に関わるもの全部(発動しなかったものも `fired: false` で入れる)。
- `knowledge_use` は、キャラが canon の knowledge にある事実を前提に話す・動く箇所。迷うものは入れない。
- `design_realization` は design.yaml の `showpieces[i]`・`texture[i]` のすべてについて 1 件ずつ(実現していなければ入れない。CI がそれを落とす)。
- 書いたら `DATA_DIR=DATA pnpm --dir <novel-atlas> -s check-data --work <作品> --episode <N> --only schema,canon` を流し、「claims の引用」「参照」のエラーが 0 になるまで claims を直す。ほかのエラー(知識・異能・口調など)は本文か canon の問題なので claims で隠さない。
