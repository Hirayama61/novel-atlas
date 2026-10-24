// zod スキーマから JSON Schema を書き出す(エディタの yaml-language-server 用)。
//   pnpm schemas  → schemas/*.schema.json

import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import * as S from "../src/core/schema";

const targets: Record<string, z.ZodType> = {
  character: S.Character,
  timeline: S.Timeline,
  threads: S.Threads,
  rules: S.Rules,
  places: S.Places,
  premise: S.Premise,
  design: S.Design,
  claims: S.Claims,
  "lint-allow": S.LintAllow,
  work: S.Work,
  arcs: S.Arcs,
  handoff: S.Handoff,
  ledger: S.Ledger,
  feedback: S.Feedback,
};

mkdirSync("schemas", { recursive: true });
for (const [name, schema] of Object.entries(targets)) {
  writeFileSync(
    `schemas/${name}.schema.json`,
    JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2) + "\n",
  );
}
console.log(`schemas/: ${Object.keys(targets).length} 件`);
