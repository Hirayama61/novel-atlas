// 投稿用の本文。旧 write-episode C-2 の perl 変換と同じ規則:
// 見出し行(# )と了行(（第N話 了）)を除き、行頭の全角空白を 1 つ外す。
import { countChars } from "./check/text";

export function toPostingText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("# ") && !/^（第\s*\d+\s*話\s*了）/.test(l))
    .map((l) => l.replace(/^　/, ""));
  while (lines.length && !lines[0]!.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  return lines.join("\n") + "\n";
}

export function postingStats(text: string) {
  const posting = toPostingText(text);
  const lines = posting.trimEnd().split("\n");
  return { chars: countChars(posting), first: lines[0] ?? "", last: lines[lines.length - 1] ?? "" };
}
