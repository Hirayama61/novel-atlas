import { db } from "../db/db";
import { getBlob, getCommitSha, getTree, type DataRepoConfig } from "./github";

export interface SyncProgress {
  done: number;
  total: number;
}

/** ref の tree を取り、手元に無い blob だけを取る */
export async function syncRef(
  config: DataRepoConfig,
  ref: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ fetched: number; total: number; commit: string }> {
  // 先にコミットを固定し、その SHA の tree を読む(途中で push されても食い違わない)
  const commit = await getCommitSha(config, ref);
  const tree = await getTree(config, commit);
  const shas = [...new Set(tree.entries.map((e) => e.sha))];
  const have = new Set((await db.blobs.bulkGet(shas)).filter(Boolean).map((b) => b!.sha));
  const missing = shas.filter((s) => !have.has(s));
  let done = 0;
  const queue = [...missing];
  const CONCURRENCY = 6;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const sha = queue.shift()!;
        const content = await getBlob(config, sha);
        await db.blobs.put({ sha, content });
        onProgress?.({ done: ++done, total: missing.length });
      }
    }),
  );
  await db.trees.put({
    ref,
    commit,
    files: Object.fromEntries(tree.entries.map((e) => [e.path, e.sha])),
    syncedAt: new Date().toISOString(),
  });
  return { fetched: missing.length, total: tree.entries.length, commit };
}
