// 架空の短い作品「灯台守の娘」。テスト用。実在の作品の本文や設定を置かない。

export const TEXT_1 = `# 第1話 灯台の夜

　灯室の窓が赤く割れた。
　父の目はもう灯を追えない。

　◇

「潮は今夜引く」
　ミオは言い切った。

（第1話 了）
`;

export const TEXT_2 = `# 第2話 港へ

　ミオは港へ下りた。
　父さんには灯は見えてない、と漁師に言った。
`;

export const FILES: [string, string][] = [
  [
    "works/lh/work.yaml",
    `id: lh
title: 灯台守の娘
status: 連載中
schedule: { cadence: weekly, wip_limit: 1 }
length: { target_chars: 100, max_chars: 120 }
chapters:
  - { no: 1, title: 灯, episodes: [1, 4] }
  - { no: 2, title: 港, episodes: [5, 8] }
`,
  ],
  ["works/lh/episodes/001/text.md", TEXT_1],
  ["works/lh/episodes/002/text.md", TEXT_2],
  [
    "works/lh/canon/characters/mio.yaml",
    `id: mio
name: ミオ
status: 確定
since: 1
attributes:
  - { id: mio.age, key: 年齢, value: 17, status: 確定 }
knowledge:
  - { fact: lh.blind, from: 2, status: 確定 }
  - { fact: lh.letter, from: null, status: 確定 }
`,
  ],
  [
    "works/lh/canon/characters/father.yaml",
    `id: father
name: 父
status: 確定
attributes:
  - id: lh.blind
    key: 目
    value: 灯を追えない
    status: 確定
    since: 1
    sources: [{ ep: 1, quote: 父の目はもう灯を追えない }]
  - { id: lh.letter, key: 手紙, value: 母の手紙を隠している, status: 仮 }
`,
  ],
  [
    "works/lh/canon/places.yaml",
    `places:
  - { id: lighthouse, name: 灯台, status: 確定 }
  - { id: harbor, name: 港, status: 確定, parent: lighthouse }
`,
  ],
  [
    "works/lh/canon/threads.yaml",
    `threads:
  - id: F1
    title: 切り取られた頁
    kind: 回収伏線
    status: 確定
    planted: { ep: 1 }
    reveal: { not_before: 5 }
    sealed_terms: ['母の手紙']
`,
  ],
  [
    "works/lh/canon/rules.yaml",
    `abilities:
  - id: ability.tide
    holder: mio
    status: 確定
    trigger: { kinds: [断言, 命令] }
    no_trigger: { kinds: [願望, 疑問] }
    effect: 言い切ったことが実現する
    drift: { required: true, kinds: [時機, 規模] }
lexicon:
  - { prefer: 灯室日誌, avoid: [航海日誌] }
`,
  ],
  [
    "works/lh/handoff.yaml",
    `items:
  - { id: H-3-01, target: 3, kind: 弱点, text: 父の出番を増やす, status: open }
`,
  ],
];

export const DESIGN_3 = `work: lh
episode: 3
title: { working: 灯を消す, final: null }
position: { chapter: 1, role: 転換 }
status: designing
emotion_goal: 父を置いて行く苦さ
core: 娘が灯を消す
type: { label: 転換 }
synopsis:
  - part: 起
    target_chars: 50
    summary: 嵐が来る
    scenes:
      - id: s1
        place: lighthouse
        characters: [mio, father]
        beats: [父が灯を点けない]
        knowledge_use: [{ who: mio, fact: lh.blind }]
  - part: 結
    target_chars: 50
    summary: 灯を消す
    scenes:
      - { id: s2, place: harbor, characters: [mio], beats: [灯が消える] }
hook: { scene: s2, text: 灯が消えた, why: 船が来る }
showpieces: [{ scene: s2, picture: 消えた灯と娘の影 }]
texture:
  - { kind: 暮らし, element: 網を家に入れる, scene: s1 }
  - { kind: 気候, element: 塩の雨, scene: s2 }
cast:
  - { who: mio, desire: 灯を守る, action: 消す, new_facet: 嘘をつく }
  - { who: father, desire: 灯を守る, action: 黙る, new_facet: 歌う }
threads: { plant: [], advance: [], payoff: [], keep: [F1] }
ability_checks:
  - { scene: s1, utterance: 嵐は来ない, kind: 断言, expect_fire: true, drift: 規模 }
budget: { total: 100, emotional_core: { scenes: [s2], chars: 50 } }
handoff_in: [{ id: H-3-01, action: consume, how: s1 }]
`;
