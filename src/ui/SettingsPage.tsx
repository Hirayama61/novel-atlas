import { useState } from "react";
import { db } from "../db/db";
import { loadConfig, saveConfig } from "../sync/github";
import { IssueSheet } from "./issue/IssueSheet";

export function SettingsPage() {
  const [config, setConfig] = useState(loadConfig);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  return (
    <div className="settings">
      <h2>設定</h2>
      <label>
        データリポジトリ
        <input
          value={`${config.owner}/${config.repo}`}
          onChange={(e) => {
            const [owner = "", repo = ""] = e.target.value.split("/");
            setConfig({ ...config, owner, repo });
          }}
        />
      </label>
      <label>
        Fine-grained PAT
        <input
          type="password"
          value={config.token}
          onChange={(e) => setConfig({ ...config, token: e.target.value.trim() })}
          autoComplete="off"
        />
      </label>
      <p className="muted">
        対象は novel-atlas-data と novel-atlas にする。novel-atlas-data には Contents: Read and
        write、Pull requests: Read and write、Metadata: Read を付ける。改善 Issue
        を作るなら、novel-atlas に Issues: Read and write を足す。Contents
        の書き込みは参考作品の一覧(references/works.csv)を書くのに使う。
      </p>
      <label className="row">
        <input
          type="checkbox"
          checked={config.remember}
          onChange={(e) => setConfig({ ...config, remember: e.target.checked })}
        />
        この端末にトークンを記憶する
      </label>
      <button
        onClick={() => {
          saveConfig(config);
          setSaved(true);
        }}
      >
        保存
      </button>
      {saved ? <span className="muted"> 保存しました</span> : null}
      <h3>アプリの改善</h3>
      {isIssueOpen ? (
        <IssueSheet onClose={() => setIsIssueOpen(false)} />
      ) : (
        <button onClick={() => setIsIssueOpen(true)}>改善 Issue を書く</button>
      )}
      <h3>端末のデータ</h3>
      <button
        onClick={async () => {
          await Promise.all([db.blobs.clear(), db.trees.clear()]);
          setCleared(true);
        }}
      >
        同期データを消す(下書きと読了位置は残す)
      </button>
      {cleared ? <span className="muted"> 消しました。次に開いたとき取り直します。</span> : null}
    </div>
  );
}
