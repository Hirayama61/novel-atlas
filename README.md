# novel-atlas

自分用の小説アトラス。連載小説の執筆ループを回す検査スクリプトと、読書・PR コメント・設定資料の PWA。

- アプリ本体(このリポジトリ): GitHub Pages で公開。本文・設定は含まない。
- データ: 非公開の novel-atlas-data。1 話 = 1 PR で書き、マージが確定稿になる。
- 設計: [docs/design/](docs/design/README.md)

## 開発

```
pnpm install
pnpm dev
pnpm check
```

詳細は [CLAUDE.md](./CLAUDE.md)。
