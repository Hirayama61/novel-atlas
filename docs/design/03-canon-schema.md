# 03. canon の YAML スキーマと照合 CI

canon は `works/<作品>/canon/` 以下の YAML。
スキーマは `novel-atlas/src/core/schema/` に zod で書き、そこから JSON Schema を生成する。
JSON Schema はエディタ補完(yaml-language-server)と Actions の検証に使う。
同じ zod スキーマをビューアと scripts が読むので、型が一か所で決まる。

例は架空の作品「灯台守の娘」で書く。

## 共通の項目(すべての事実が持つ)

canon の「事実」はキャラの属性・出来事・伏線・法則のどれであっても、次の項目を持つ。

```yaml
id: lighthouse.keeper-blind     # 作品内で一意。他の項目から参照する
status: 確定                     # 確定 | 仮
since: 3                        # この事実が本文で初めて成り立った話。未登場なら null
sources:                        # 出典行。本文のどこで成り立ったか
  - ep: 3
    quote: 父の目はもう灯を追えない   # 本文の部分文字列。行番号は持たない
note: 第 5 話で回復の可能性に触れる余地を残す   # 自由記述。照合には使わない
```

- **`status`**: `確定` は照合で食い違えば CI を落とす。`仮` は警告だけ出す。
  本文に出た事実(`sources` を持つ事実)はマージ後同期で `確定` に上げる。本文に出たものは戻せないから。
  本文に出ていない `確定`(例: 結末方向)は作者が背骨として固定したもの。
- **`sources` は行番号でなく引用で持つ。**
  改稿で行がずれても引用は残る。CI は引用を本文から探して行番号を解決し、ビューアは出典へ飛べる。
  引用が本文から消えたら CI が「出典切れ」を出す。事実を成り立たせていた文を消した改稿を検出できる。
- **`id`** はドット区切りの ASCII。日本語の表示名は各項目の `name` / `title` に持つ。

## characters/<id>.yaml

```yaml
id: mio
name: ミオ
aliases: [灯台の娘, ミオ嬢]     # 本文に出る呼び名。未登録の呼び名は CI が警告する
status: 確定
since: 1
role: 主人公

profile:                        # 読者に見えてよい表層(旧・公開/登場人物.md)
  appearance: 潮で褪せた赤毛。右手に古い火傷
  personality: 段取りを先に決めたがる。決めたことを曲げられると黙る

attributes:                     # 照合対象の属性。1 項目 = 1 事実
  - id: mio.age
    key: 年齢
    value: 17
    status: 確定
    since: 1
    sources: [{ ep: 1, quote: 十七になった春 }]
  - id: mio.burn
    key: 右手の火傷
    value: 幼い頃に灯室で負った
    status: 仮

core:                           # 根幹(旧・キャラ根幹.md)。照合には使わず、整合性レビュアーと執筆が読む
  - id: mio.core.motive
    status: 確定
    text: 灯台を継ぐのは父のためではなく、母の失踪の記録を灯室日誌から探すため
    reveal: { not_before: 10 }   # この話より前に本文で明かさない

voice:                          # 旧・声テーブル
  first_person: 私
  second_person: { default: あなた, toward: { father: 父さん } }
  endings: [〜だから, 〜でしょう]
  vocabulary: [灯, 潮目, 段取り]
  avoid:                        # 使わない言葉
    - text: 雅語
    - pattern: 'わたくし'         # 正規表現。台詞の話者がこのキャラの行にだけ当てる
  established:                  # 本文の実績(マージ後同期が台詞から集計して足す)
    endings: [〜だから, 〜でしょう, 〜のよ]
  notes:                        # PR コメント由来の口調の確定事項
    - text: 怒るときほど丁寧語になる
      evidence: [feedback.004.12, feedback.006.31]

relations:
  - to: father
    kind: 親子
    since: 1
    state: 父の目の衰えを本人より先に知っている
    status: 確定

knowledge:                      # 第 N 話時点で知っていること(一級項目)
  - fact: lighthouse.keeper-blind
    from: 2                     # この話から知っている
    how: 灯の点け損じを見た
    status: 確定
  - fact: mother.letter
    from: null                  # まだ知らない(明示する)
    status: 確定
  - fact: harbor.debt
    from: 4
    belief: 借金は叔父のものだと思っている   # 誤信。事実と違う理解で持っている
    status: 仮
```

### 知識状態の扱い

- `knowledge` は「そのキャラが、その事実を、何話から知っているか」を持つ。`fact` は canon の任意の事実の `id` を指す(出来事・属性・伏線・法則)。
- `from: null` は「知らない」と明示した状態。書いていない事実は「未定義」で、照合は警告だけ出す。
  守りたい無知(このキャラにまだ知らせないこと)は `from: null` で書く。
- `until` を持てる(忘れた・記憶を失った)。
- `belief` は誤信。そのキャラが事実と違う理解で行動するときに使う。照合は「`belief` と違う理解で行動していないか」を見る。
- 照合: claims の `knowledge_use`(本文でキャラがある事実を知っている前提で話す・動く箇所)と突き合わせ、`from` > 当該話ならエラー。

## timeline.yaml

年表の精度を粗く保つため、時刻は絶対値でなく「錨と相対」で持つ。

```yaml
calendars:                      # この作品の時間の数え方
  - id: story-day               # 物語内の通し日。第 1 話を day 1 とする
  - id: rainy-season            # 季節内の日数
    length: { approx: 45 }

anchors:
  - id: era.old-war
    label: 大戦
    when: { approx: '約 200 年前' }   # 数値にしない
    status: 確定

events:
  - id: ep1.fire
    title: 灯室の火事
    when: { calendar: story-day, day: 1, part: 夜 }
    episode: 1
    participants: [mio, father]
    places: [lighthouse]
    status: 確定
    sources: [{ ep: 1, quote: 灯室の窓が赤く割れた }]
  - id: ep5.market
    title: 港市の初日
    when: { after: ep4.storm, gap: { approx: 数日 } }   # 相対指定。日数を決めない
    episode: 5
    status: 確定
  - id: ep6.flood
    title: 堤の決壊
    when: { calendar: rainy-season, day: 8 }
    also: { after: ep5.market }
    episode: 6
    status: 確定
```

- `when` は `calendar`+`day`、`after`/`before`+`gap`、`approx`(文字列)のいずれか。
- 照合は半順序の整合を見る。
  - `after`/`before` と各カレンダーの日付から順序グラフを作り、循環が無いこと。
  - 話の番号順と出来事の順序が逆転するなら `flashback: true` を必須にする。
  - claims の `time_marker`(「三日後」「雨季八日目」)が timeline の `確定` 事実と矛盾しないこと。
- 地名・人物は `places` / `participants` で ID 参照する。未登録 ID は CI が落とす。

## threads.yaml(伏線)

```yaml
threads:
  - id: F5
    title: 破られた日誌の一頁
    status: 確定
    kind: 回収伏線               # 回収伏線 / 通し大伏線 / 常設種 / 成長線 / 損の在庫
    planted: { ep: 3, sources: [{ ep: 3, quote: 一頁だけ、刃物で切り取られていた }] }
    answer:                     # 答え。隔離バンドルには入らない
      text: (作者だけが持つ答え)
      status: 確定
    reveal: { not_before: 8, planned: null }
    sealed_terms: []            # 回収前に本文に出してはいけない語(正規表現)
    events:                     # 進行の記録
      - ep: 5
        kind: advance           # plant / advance / payoff / echo
        note: 切り取った頁の行方を本文で確定
    options:                    # 回収の候補(仮)。散文の候補を箇条書きで残す
      - 父が持っていた
      - 頁は失われたまま、意味だけが変わる
    obligations:                # 異能の断言の残債など、回収しないと法則が破れるもの
      - text: 後半の断言が未成就
        due: { by_chapter: 2 }
```

- 照合:
  - 話設計書の `threads.payoff` に挙げた伏線は、それ以前の話で `plant` 済みであること。
  - `reveal.not_before` より前の話の本文に `sealed_terms` が出たらエラー(単純な文字列照合で決まる)。
  - `obligations` の `due` を過ぎても `payoff` が無ければ警告。旧台帳の「忘れて放置すると異能ルールの静かな破れになる」をここで拾う。
- 作品全体で温存する語(大域の謎の固有名など)は `rules.yaml` の `sealed_terms` に置き、全話に効かせる。

## rules.yaml(世界の法則・異能・防衛線)

```yaml
abilities:
  - id: ability.tide-call
    holder: mio
    status: 確定
    trigger:                    # 発動する発話・行為の種類
      kinds: [断言, 命令, 宣言]
      weight: 重みを乗せて言い切った発話に限る
    no_trigger:
      kinds: [疑問, 推量, 条件, 願望, 冗談, 相槌, 日常の命令]
    effect: 言い切った内容が必ず実現する
    drift:                      # 実現のしかたの歪み。発動したら必ずどれかが起きる
      required: true
      kinds: [字面, 解釈, 主体, 規模, 時機]
    irreversible: true

constraints:                    # 描写の防衛線
  - id: constraint.no-modern-tech
    status: 確定
    text: 蒸気機関より後の技術を出さない
    forbidden_patterns: ['電灯', '電信', '発電']   # 機械で拾える部分
    review: 整合性レビュアーが毎話確かめる                  # 機械で拾えない部分

sealed_terms:                   # 作品全体で温存する語
  - pattern: '(作品固有の秘匿語)'
    until: { chapter: 4 }

lexicon:                        # 表記の統一(固有名・呼称の撃ち分け)
  - prefer: 灯室日誌
    avoid: ['航海日誌', '灯台日記']
    except: [{ ep: 3, quote: (意図的例外の文) }]
```

- 照合: claims の `ability_use` が `trigger` / `no_trigger` の種類と合うか、発動したなら `drift` を持つか。
- `lexicon` は lint 辞書(`vocab.tsv`)と役割が重なる。canon 由来の表記(固有名・呼称)は `lexicon`、作者の嗜好由来の語は `vocab.tsv` に置く。

## places.yaml / premise.yaml

- `places.yaml`: `id`・`name`・`aliases`・`parent`(どの街の一角か)・`description`・`since`・`sources`。
- `premise.yaml`: 一行・読者への約束・大域の謎・結末方向・世界の広がり。
  `surface`(読者に見せてよい表層: 旧 `公開/テーマ.md`・`世界観.md`)と `hidden`(作者だけが持つもの)に分ける。
  照合には使わない。執筆と整合性レビュアーが読む。

## 照合 CI の判定方式

散文を毎回全部読むのでなく、話ごとに「本文が何を述べたか」を claims に抽出し、canon と突き合わせる。

```text
text.md ──(LLM が抽出: ルーティン内)──▶ claims.yaml ──(決定的な照合: Actions)──▶ 結果
                                                ▲
                        canon/*.yaml・design.yaml ┘
```

### claims.yaml(話ごと・自動生成)

```yaml
text_sha: 3f2a...               # 抽出に使った text.md の blob SHA。本文が変われば取り直し
extractor: { model: <モデル名>, prompt_version: 3 }
speakers:                       # 台詞行の話者(ビューアの話者表示と口調照合に使う)
  - { line: 12, who: mio }
  - { line: 14, who: father }
names:                          # 本文に出た固有名と、その解決先
  - { quote: ミオ嬢, resolves_to: mio }
  - { quote: ハロルド, resolves_to: null }   # 未登録
facts:                          # 本文が成り立たせた事実
  - { about: mio.age, value: 17, quote: 十七になった春 }
events:
  - { id: ep1.fire, quote: 灯室の窓が赤く割れた }
time_markers:
  - { quote: 三日後, relative_to: ep4.storm, gap_days: 3 }
knowledge_use:                  # キャラがある事実を知っている前提で話す・動く箇所
  - { who: mio, fact: lighthouse.keeper-blind, quote: 父さんには灯は見えてない }
ability_use:
  - { who: mio, quote: 潮は今夜引く, kind: 断言, fired: true, drift: 時機 }
threads:
  - { id: F5, kind: echo, quote: 切り取られた頁のことを思い出した }
design_realization:             # 話設計書の各欄が本文のどこで実現したか(04)
  - { item: showpieces[0], quote: 灯室の窓が赤く割れた }
```

### 判定(`pnpm canon-check`)

| 検査 | 入力 | 失敗の条件 |
| --- | --- | --- |
| スキーマ | canon・design・claims | zod の検証エラー |
| 参照 | canon・design・claims | 存在しない ID への参照 |
| 出典 | canon の `sources` | 引用が本文に見つからない |
| claims の鮮度 | claims の `text_sha` | 本文の SHA と違う(抽出し直していない) |
| claims の引用 | claims の各 `quote` | 本文に見つからない(抽出の幻覚) |
| 固有名 | claims の `names` | `resolves_to: null` が `確定` の登場人物・場所と表記違いで近い(表記揺れ)。新規名は警告 |
| 属性 | claims の `facts` | `確定` 属性と値が違う |
| 時系列 | timeline と claims の `time_markers` | 順序の矛盾・循環 |
| 知識 | characters の `knowledge` と claims の `knowledge_use` | 知る前の話で知っている前提で動く |
| 異能 | rules と claims の `ability_use` | 不発条件の種類で発動、発動したのにズレ無し |
| 伏線 | threads と design・本文 | 未撒きの回収、`not_before` 前の封印語の出現 |
| 口調 | characters の `voice.avoid` と claims の `speakers` | 話者の行に `avoid.pattern` が出る |
| 表記 | rules の `lexicon`・`vocab.tsv` | 避ける表記の出現(例外は `lint-allow.yaml`) |

- 食い違いの相手が `仮` なら、どの検査も警告に落とす。
- 結果は PR に 1 件のチェック(`canon`)として出し、失敗の各行に本文の行番号と canon のパスを添える。
- **LLM が担うのは抽出だけ。**
  抽出の誤りは「claims の引用が本文に無い」「同じ本文で抽出し直すと結果が変わる」で見える。
  抽出は 1 話ぶんの本文と canon の ID 一覧だけを入力にするので、全話を読む必要がない。
- 抽出はルーティンが行う(Actions に API キーを置かない)。
  Actions は claims の鮮度を見るだけなので、ルーティンが抽出を忘れれば CI が落ちる。

### lint(`pnpm lint-text`)

canon 照合とは別のチェックとして出す。

- `check.pl` を TypeScript に移植した句読点検査(S4・FRAG は失敗、TTE・C2 は件数を報告)。
- `vocab.tsv`(共通 + 作品固有)の全行照合。
- textlint(日本語の一般則。採る規則は 1 段目で既存 6 話に流して誤検出の量を見てから決める)。
- `ledger.yaml` のうち `check: pattern` を持つ規則。
- 意図的な例外は `episodes/NNN/lint-allow.yaml` に「引用・規則・理由」で書く。理由の無い例外は落とす。
