import Dexie, { type EntityTable } from "dexie";

/** blob の中身。SHA が同じなら中身も同じなので、ブランチをまたいで共有する */
export interface BlobRecord {
  sha: string;
  content: string;
}

/** ref ごとのファイル一覧(パス → blob SHA) */
export interface TreeRecord {
  ref: string;
  /** 同期したコミットの SHA(PR にコメントするとき、PR の head と一致するか確かめる) */
  commit: string;
  files: Record<string, string>;
  syncedAt: string;
}

/** 読了位置。キーは `${ref}:${path}` */
export interface PositionRecord {
  key: string;
  line: number;
  updatedAt: string;
}

/** PR に送る前のコメントの下書き */
export interface DraftRecord {
  id?: number;
  pr: number;
  path: string;
  startLine: number;
  line: number;
  quote: string;
  body: string;
  blob: string;
  ep: number;
  createdAt: string;
}

export const db = new Dexie("novel-atlas") as Dexie & {
  blobs: EntityTable<BlobRecord, "sha">;
  trees: EntityTable<TreeRecord, "ref">;
  positions: EntityTable<PositionRecord, "key">;
  drafts: EntityTable<DraftRecord, "id">;
};

db.version(1).stores({
  blobs: "sha",
  trees: "ref",
  positions: "key",
  drafts: "++id, pr",
});

export async function filesOf(ref: string): Promise<Map<string, string> | null> {
  const tree = await db.trees.get(ref);
  if (!tree) return null;
  const shas = [...new Set(Object.values(tree.files))];
  const blobs = await db.blobs.bulkGet(shas);
  const bySha = new Map(blobs.filter((b): b is BlobRecord => !!b).map((b) => [b.sha, b.content]));
  const out = new Map<string, string>();
  for (const [path, sha] of Object.entries(tree.files)) {
    const c = bySha.get(sha);
    if (c !== undefined) out.set(path, c);
  }
  return out;
}
