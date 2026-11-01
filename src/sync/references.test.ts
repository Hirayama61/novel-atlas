import { afterEach, describe, expect, it, vi } from "vitest";
import { addReference } from "../core/references";
import { DEFAULT_CONFIG } from "./github";
import { editReferencesCsv } from "./references";

const CONFIG = { ...DEFAULT_CONFIG, token: "test-token" };

const toBase64 = (text: string) =>
  btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(""));
const fromBase64 = (base64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** GET には順に `files` を返し、PUT には順に `putStatuses` を返す */
function mockFetch(files: (string | null)[], putStatuses: number[]) {
  const puts: { sha?: string; content: string }[] = [];
  let gets = 0;
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === "PUT") {
      puts.push(JSON.parse(init.body as string) as { sha?: string; content: string });
      const status = putStatuses[puts.length - 1] ?? 200;
      return json({}, status);
    }
    const text = files[gets];
    gets++;
    if (text === null || text === undefined) return json({ message: "Not Found" }, 404);
    return json({ sha: `sha${gets}`, content: toBase64(text) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { puts };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("参考作品の一覧を書き戻す", () => {
  it("ファイルが無ければ sha を付けずに作る", async () => {
    const { puts } = mockFetch([null], []);
    const result = await editReferencesCsv(CONFIG, (t) => addReference(t, "n1234ab"), "m");
    expect(result).toEqual({ kind: "ok" });
    expect(puts[0]!.sha).toBeUndefined();
    expect(fromBase64(puts[0]!.content)).toBe("ncode,title,volumes,note\nn1234ab,,,\n");
  });

  it("SHA が食い違ったら読み直し、新しい中身に足してやり直す", async () => {
    const first = "ncode,title,volumes,note\n";
    const second = "ncode,title,volumes,note\nn2222bb,潮見,,\n";
    const { puts } = mockFetch([first, second], [409, 200]);
    const result = await editReferencesCsv(CONFIG, (t) => addReference(t, "n1234ab"), "m");
    expect(result).toEqual({ kind: "ok" });
    expect(puts.map((p) => p.sha)).toEqual(["sha1", "sha2"]);
    expect(fromBase64(puts[1]!.content)).toBe(`${second}n1234ab,,,\n`);
  });

  it("読み直した中身に既にあれば書かずに理由を返す", async () => {
    const { puts } = mockFetch(["ncode\n", "ncode\nn1234ab\n"], [409]);
    const result = await editReferencesCsv(CONFIG, (t) => addReference(t, "n1234ab"), "m");
    expect(result).toEqual({ kind: "error", reason: "n1234ab は登録済みです" });
    expect(puts).toHaveLength(1);
  });

  it("食い違いが 3 回続いたら諦めて失敗を返す", async () => {
    const { puts } = mockFetch(["ncode\n", "ncode\n", "ncode\n"], [409, 409, 409]);
    await expect(editReferencesCsv(CONFIG, (t) => addReference(t, "n1234ab"), "m")).rejects.toThrow(
      "409",
    );
    expect(puts).toHaveLength(3);
  });

  it("権限不足は取り直さない", async () => {
    const { puts } = mockFetch(["ncode\n"], [403]);
    await expect(editReferencesCsv(CONFIG, (t) => addReference(t, "n1234ab"), "m")).rejects.toThrow(
      "トークンに権限がありません",
    );
    expect(puts).toHaveLength(1);
  });
});
