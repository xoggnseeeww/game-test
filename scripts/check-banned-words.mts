import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { BANNED_WORDS, DISCLAIMER } from "../content/adhd.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// Scan every source file that can render user-facing copy, not just
// content/adhd.ts — button labels and headings sometimes live inline in
// pages/components.
const SCAN_DIRS = ["app", "components", "content"];
const SCAN_EXTENSIONS = [".ts", ".tsx"];

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (SCAN_EXTENSIONS.includes(entry.slice(entry.lastIndexOf(".")))) {
      files.push(full);
    }
  }
  return files;
}

const files = SCAN_DIRS.flatMap((d) => collectFiles(join(repoRoot, d)));

let hadOffenders = false;

for (const file of files) {
  let raw = readFileSync(file, "utf-8");

  // The DISCLAIMER string necessarily negates "진단"/"치료", and the
  // BANNED_WORDS array necessarily contains them literally — both are
  // deliberately reviewed exceptions, not copy that ships as a claim.
  raw = raw.split(DISCLAIMER).join("");
  raw = raw.replace(/export const BANNED_WORDS[\s\S]*?\] as const;/, "");

  const offenders = BANNED_WORDS.filter((word) => raw.includes(word));
  if (offenders.length > 0) {
    hadOffenders = true;
    console.error(`금지어 발견: ${relative(repoRoot, file)}`);
    for (const word of offenders) console.error(`  - "${word}"`);
  }
}

if (hadOffenders) {
  process.exit(1);
}

console.log(
  `금지어 검사 통과 (${BANNED_WORDS.length}개 단어 × ${files.length}개 파일, DISCLAIMER는 의도적으로 제외)`
);
