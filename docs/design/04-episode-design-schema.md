# 04. 話設計書の YAML スキーマ

`works/<作品>/episodes/NNN/design.yaml`。
旧 `物語設計原則.md` §1 のテンプレの各欄を項目にし、照合に使える形にした。
§1 の「作業ログ部」(ステータス・却下・指摘ログ)は PR と `feedback/` が持つので、`rejected` だけを残す。

YAML にする狙いは 2 つ。

- 執筆する AI が埋めるべき欄が明確になり、空欄があれば CI が落とす(「全欄が埋まるまで本文を書かない」の強制)。
- 本文が設計を実現したかを、claims の `design_realization` と突き合わせて確かめられる。

## スキーマ

```yaml
work: lighthouse
episode: 7
title:
  working: 灯台守、港へ下りる      # 作業中の題
  final: null                    # マージ前に決める。投稿題になる
  rejected: [{ text: 灯は消えない, why: 第 3 話の引きと同語 }]
position:
  chapter: 2
  arc: 嵐の季節                   # arcs.yaml の山の名前
  role: 危機の本番                # 話の型ラベル。採点台帳に写る
status: designing                # designing | approved | drafting | reading | published

emotion_goal: |                  # 感情目的(1〜2 行)
  読み終えた読者に残したい感情・体験
core: |                          # 本話の芯。レビューで外さない中心
  …

type:                            # 話の型
  label: 危機の本番 × 救出の失敗
  recent:                        # 直近の話の型(CI が前話の design.yaml から埋める。手で書かない)
    - { ep: 5, label: 日常 × 商売コメディ }
    - { ep: 6, label: 危機の立ち上げ × 選択 }
  breaks:                        # 直近と同じビートにしないための崩し方
    - who: father
      habit: 黙って灯を点け直す
      instead: 灯を点けずに港へ下りる

time:                            # canon/timeline.yaml の語彙で書く
  start: { calendar: rainy-season, day: 10 }
  span: { days: 1 }
  new_events: [ep7.rescue]       # この話で timeline に足す出来事(PR で canon に仮登録)

synopsis:                        # あらすじ(起承転結)。場面単位で持つ
  - part: 起
    target_chars: 1000
    summary: 各段落 2〜3 行
    scenes:
      - id: s1
        place: lighthouse
        characters: [mio, father]
        beats:
          - 父が灯を点けないと言う
        knowledge_use:           # この場面でキャラが前提にする事実(canon の knowledge と照合)
          - { who: mio, fact: lighthouse.keeper-blind }
  - part: 承
    target_chars: 2000
    summary: …
    scenes: [...]

hook:                            # 引き
  scene: s9
  text: 話末の引きの一文・一場面
  why: 次話を読まずにいられない理由

showpieces:                      # 見せ場(1 つ以上)
  - scene: s4
    picture: 構図・光・表情まで想像できる粒度の画

texture:                         # 世界観テクスチャ(2 要素以上)
  - kind: 暮らし                  # 種族 / 魔法の日常 / 街並み・暮らし / 食・金・仕事 / 気候・信仰・娯楽
    element: 嵐の前に網を家に入れる漁師たち
    scene: s2
  - kind: 気候
    element: …
    scene: s5

cast:                            # 登場キャラ全員
  - who: mio
    desire: この話での独自の欲
    action: 欲から出る行動
    new_facet: 前話までに見せていない面
  - who: father
    desire: …
    action: …
    new_facet: …

threads:                         # 伏線(canon/threads.yaml の ID)
  plant:   [{ id: F9, note: 新しく撒く種 }]
  advance: [{ id: F5, note: 頁の行方が一段わかる }]
  payoff:  []
  keep:    [F2]                  # この話でも温存する(触れない)

ability_checks:                  # 異能の発動確認(canon/rules.yaml と照合)
  - scene: s6
    utterance: 潮は今夜引く
    kind: 断言
    expect_fire: true
    drift: 時機
    lands_on: 誰に・何にズレが落ちるか

budget:                          # 字数配分
  total: 8500
  emotional_core: { scenes: [s7, s8], chars: 2500 }   # 感情の核に先に確保する字数(原則 §6)

handoff_in:                      # 申し送り(handoff.yaml の ID)の扱い
  - { id: H-7-03, action: consume, how: s3 で回収 }
  - { id: H-7-05, action: defer, to: 8, why: 本話の型と合わない }

references:                      # 他作品の解析結果を参考にした箇所(3 段目)
  - { work: n0000xx, item: threads.T12, note: 中盤の山の割り方 }

rejected:                        # 却下した案と理由(旧・却下節)
  - what: 父を嵐で死なせる
    why: カタルシス担保(後味を悪く終わらせない)に反する
    source: design-review        # design-review / reviewer:<名前> / feedback.<id>

revisions:                       # 通し改稿の記録(第 1〜3 話の改稿 v2 など)
  - version: v2
    date: 2026-07-02
    summary: …
```

## 設計段階の CI(`design.yaml` だけで判定できるもの)

| 検査 | 失敗の条件 |
| --- | --- |
| 必須欄 | `emotion_goal`・`core`・`type.label`・`synopsis`・`hook`・`showpieces`・`texture`・`cast`・`budget` のどれかが空 |
| 見せ場 | `showpieces` が 0 件 |
| テクスチャ | `texture` が 2 件未満、または全件が同じ `kind` |
| キャスト | 場面の `characters` に出るのに `cast` に無いキャラがいる。`cast` の `desire` か `new_facet` が空 |
| 型の反復 | `type.label` が直近 2 話のどちらかと同一(警告) |
| 同じビートの反復 | `cast[].action` が前話の同じキャラの `action` と同一文字列(警告) |
| 伏線 | `payoff` が未撒き、`keep` に挙げた伏線を `advance` / `payoff` にも挙げている |
| 異能 | `ability_checks` の `kind` と `expect_fire` が rules と食い違う |
| 知識 | 場面の `knowledge_use` がそのキャラの `knowledge.from` より前 |
| 字数 | 各部の `target_chars` の合計が `budget.total` と ±10% 以上ずれる。`emotional_core` が未指定 |
| 申し送り | `handoff.yaml` の、この話を `target` にした `open` 項目が `handoff_in` に無い |
| 時間 | `time.start` が前話の終わりより前(`flashback` 指定なし) |

「主人公への反応しかしていないキャラ」のように意味で決まる検査は、CI でなく設計レビュー(内部の `story-consistency-reviewer`)が見る。

## 本文段階の CI(`design.yaml` と claims を突き合わせる)

| 検査 | 失敗の条件 |
| --- | --- |
| 見せ場の実現 | `showpieces[i]` に対応する `design_realization` が無い |
| テクスチャの実現 | `texture[i]` に対応する引用が無い |
| キャストの登場 | `cast` のキャラが本文に一度も出ない(claims の `names`) |
| 伏線の実行 | `plant` / `advance` / `payoff` に対応する claims の `threads` が無い |
| 異能の実行 | `ability_checks` の発話が本文に無い、または `fired` / `drift` が設計と違う(警告。本文側で変えたなら設計を直す) |
| 字数 | 本文の字数(空白除く。`novel-analytics` と同じ定義)が `budget.total` の ±25% を外れる(警告) |

本文で設計を変えた場合は、設計書を本文に合わせて直してから push する。
設計と本文が食い違ったまま残ると、次話の設計が古い前提を引き継ぐ。

## 承認のゲート

- 設計 PR の段階では `design.yaml` と canon の仮登録だけが入る。
- 依頼者が PR に `design-approved` ラベルを付けると承認になる(05)。
- 承認後に `design.yaml` の設計部(`synopsis`・`cast`・`threads` 等)を変えた push があれば、CI がラベルを外して `stage:design` に戻す。
  本文段階の「設計を本文に合わせて直す」変更は、`scenes[].beats` の文言と `ability_checks.drift` に限って許す(それ以外を変えるなら再承認)。
