#!/usr/bin/env node
/**
 * icon-gen — OpenAI 이미지 API로 픽토그램/아이콘 일괄 생성기
 *
 * 의존성 없음 (Node 18+ 내장 fetch 사용). 사용법은 README.md / prompts.md 참고.
 *
 *   node generate.mjs                 전체 생성 (이미 있는 파일은 건너뜀)
 *   node generate.mjs --force         이미 있어도 다시 생성
 *   node generate.mjs --only a,b      특정 아이콘만
 *   node generate.mjs --list          목록만 미리보기
 *   node generate.mjs --dry           프롬프트만 출력 (API 호출 안 함)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = "https://api.openai.com/v1/images/generations";

// ── 작은 유틸 ────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const log = (...a) => console.log(...a);
const ok = (m) => log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => log(`${c.yellow}!${c.reset} ${m}`);
const err = (m) => log(`${c.red}✗${c.reset} ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg) {
  err(msg);
  process.exit(1);
}

// ── .env 로더 (dotenv 없이 직접 파싱) ────────────────────────
function loadEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (let line of readFileSync(envPath, "utf8").split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // 양쪽 따옴표 제거
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// ── 인자 파싱 ────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { force: false, list: false, dry: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force" || a === "-f") args.force = true;
    else if (a === "--list" || a === "-l") args.list = true;
    else if (a === "--dry" || a === "-n") args.dry = true;
    else if (a === "--only" || a === "-o") {
      const v = argv[++i];
      if (!v) die("--only 뒤에 아이콘 이름을 적어주세요 (쉼표로 구분)");
      args.only = v.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      warn(`알 수 없는 인자 무시: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  log(`${c.bold}icon-gen${c.reset} — OpenAI 이미지로 픽토그램 일괄 생성

  node generate.mjs [옵션]

  --force, -f          이미 있는 파일도 다시 생성(덮어쓰기)
  --only, -o a,b       특정 아이콘 이름만 생성 (쉼표 구분)
  --list, -l           생성될 목록만 출력 (API 호출 안 함)
  --dry,  -n           각 항목의 최종 프롬프트만 출력 (API 호출 안 함)
  --help, -h           이 도움말`);
}

// ── 설정/목록 로드 ───────────────────────────────────────────
function loadJson(name) {
  const p = join(__dirname, name);
  if (!existsSync(p)) die(`${name} 파일이 없습니다: ${p}`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    die(`${name} JSON 파싱 실패: ${e.message}`);
  }
}

// "_" 로 시작하는 주석 키 제거 + 항목 기본값 병합
function resolveItem(item, config) {
  return {
    name: item.name,
    prompt: item.prompt,
    model: item.model || config.model,
    size: item.size || config.size,
    quality: item.quality || config.quality,
    background: item.background || config.background,
    output_format: item.output_format || config.output_format,
  };
}

// ── 확장자 결정 ──────────────────────────────────────────────
function extFor(fmt) {
  if (fmt === "jpeg") return "jpg";
  return fmt || "png";
}

// ── OpenAI 호출 (재시도 포함) ───────────────────────────────
async function generateOne(item, apiKey, headersExtra) {
  const body = {
    model: item.model,
    prompt: `${item._fullPrompt}`,
    n: 1,
    size: item.size,
    quality: item.quality,
    output_format: item.output_format,
  };
  // 투명 배경은 png/webp 일 때만 의미가 있음
  if (item.background) body.background = item.background;

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...headersExtra,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // 네트워크 오류 — 재시도
      if (attempt < maxAttempts) {
        const wait = 1000 * attempt;
        warn(`${item.name}: 네트워크 오류, ${wait}ms 후 재시도 (${attempt}/${maxAttempts}) — ${e.message}`);
        await sleep(wait);
        continue;
      }
      throw new Error(`네트워크 오류: ${e.message}`);
    }

    if (res.ok) {
      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error("응답에 이미지 데이터(b64_json)가 없습니다");
      return { buffer: Buffer.from(b64, "base64"), revised: json?.data?.[0]?.revised_prompt };
    }

    // 에러 응답 처리
    const text = await res.text();
    const retriable = res.status === 429 || res.status >= 500;
    if (retriable && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter ? retryAfter * 1000 : 1500 * attempt;
      warn(`${item.name}: HTTP ${res.status}, ${wait}ms 후 재시도 (${attempt}/${maxAttempts})`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 500)}`);
  }
  throw new Error("재시도 횟수 초과");
}

// ── 동시성 제한 풀 ───────────────────────────────────────────
async function runPool(tasks, concurrency, worker) {
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (idx < tasks.length) {
      const myIdx = idx++;
      results[myIdx] = await worker(tasks[myIdx], myIdx);
    }
  });
  await Promise.all(runners);
  return results;
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadJson("config.json");
  const iconsFile = loadJson("icons.json");
  const items = Array.isArray(iconsFile.items) ? iconsFile.items : [];

  if (items.length === 0) die("icons.json 의 items 가 비어 있습니다.");

  // 이름 유효성 + 중복 검사
  const seen = new Set();
  for (const it of items) {
    if (!it.name || !/^[a-zA-Z0-9._-]+$/.test(it.name)) {
      die(`아이콘 name 이 비었거나 파일명으로 부적합합니다: ${JSON.stringify(it.name)} (영문/숫자/-/_/. 만 허용)`);
    }
    if (!it.prompt) die(`'${it.name}' 항목에 prompt 가 없습니다.`);
    if (seen.has(it.name)) die(`중복된 아이콘 name: ${it.name}`);
    seen.add(it.name);
  }

  // --only 필터
  let selected = items;
  if (args.only) {
    const set = new Set(args.only);
    selected = items.filter((it) => set.has(it.name));
    const missing = args.only.filter((n) => !seen.has(n));
    if (missing.length) warn(`icons.json 에 없는 이름: ${missing.join(", ")}`);
    if (selected.length === 0) die("선택된 아이콘이 없습니다.");
  }

  const outDir = resolve(__dirname, config.outputDir || "output");
  mkdirSync(outDir, { recursive: true });

  // 각 항목 최종 프롬프트 구성
  const stylePrompt = (config.stylePrompt || "").trim();
  const isGptImage2 = (m) => /^gpt-image-2(\b|[.-])/.test(m || "");
  const resolved = selected.map((raw) => {
    const it = resolveItem(raw, config);

    // gpt-image-2 는 투명 배경 미지원 → transparent 로 들어와도 opaque 로 처리(에러 방지).
    // 배경은 생성 후 직접 따냄. 그래서 stylePrompt 가 평평한 흰 배경을 요청함.
    if (it.background === "transparent" && isGptImage2(it.model)) {
      it._bgDowngraded = true;
      it.background = "opaque";
    }

    it._fullPrompt = stylePrompt ? `${stylePrompt}\n\nSubject: ${it.prompt}` : it.prompt;
    it._file = join(outDir, `${it.name}.${extFor(it.output_format)}`);
    return it;
  });

  const downgraded = resolved.filter((i) => i._bgDowngraded);
  if (downgraded.length) {
    warn(`투명 배경 ${downgraded.length}개 → gpt-image-2 는 투명 미지원이라 opaque(평평한 흰 배경)로 생성됩니다. 배경은 직접 제거하세요.`);
  }

  // --list / --dry
  if (args.list) {
    log(`${c.bold}생성 대상 ${resolved.length}개${c.reset}  (출력: ${outDir})\n`);
    for (const it of resolved) {
      const exists = existsSync(it._file);
      log(`  ${exists ? c.dim + "[있음]" + c.reset : "      "} ${it.name}  ${c.dim}${it.model} ${it.size} ${it.quality} ${it.background}${c.reset}`);
    }
    return;
  }
  if (args.dry) {
    log(`${c.bold}DRY RUN — API 호출 없음${c.reset}\n`);
    for (const it of resolved) {
      log(`${c.cyan}● ${it.name}${c.reset} ${c.dim}(${it.model}, ${it.size}, ${it.quality}, bg=${it.background})${c.reset}`);
      log(`${it._fullPrompt}\n`);
    }
    return;
  }

  // 실제 호출엔 API 키 필요
  const env = loadEnv();
  const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("여기에") || apiKey === "sk-...") {
    die(
      "OpenAI API 키가 설정되지 않았습니다.\n" +
      "   icon-gen/.env.example 을 .env 로 복사하고 OPENAI_API_KEY 를 채워주세요:\n" +
      "     cp .env.example .env"
    );
  }
  const headersExtra = {};
  const orgId = process.env.OPENAI_ORG_ID || env.OPENAI_ORG_ID;
  const projId = process.env.OPENAI_PROJECT_ID || env.OPENAI_PROJECT_ID;
  if (orgId) headersExtra["OpenAI-Organization"] = orgId;
  if (projId) headersExtra["OpenAI-Project"] = projId;

  // 이미 있는 파일은 건너뜀 (--force 면 전부)
  const todo = resolved.filter((it) => args.force || !existsSync(it._file));
  const skipped = resolved.length - todo.length;
  if (skipped > 0) warn(`이미 존재해서 건너뜀: ${skipped}개 (덮어쓰려면 --force)`);
  if (todo.length === 0) {
    ok("생성할 항목이 없습니다. 끝.");
    return;
  }

  log(`${c.bold}${todo.length}개 생성 시작${c.reset} ${c.dim}(동시 ${config.concurrency || 3})${c.reset}\n`);

  let done = 0, failed = 0;
  const failures = [];
  await runPool(todo, config.concurrency || 3, async (it) => {
    try {
      const { buffer, revised } = await generateOne(it, apiKey, headersExtra);
      writeFileSync(it._file, buffer);
      done++;
      ok(`[${done + failed}/${todo.length}] ${it.name}.${extFor(it.output_format)} ${c.dim}(${(buffer.length / 1024).toFixed(0)} KB · ${it.model})${c.reset}`);
    } catch (e) {
      failed++;
      failures.push({ name: it.name, error: e.message });
      err(`[${done + failed}/${todo.length}] ${it.name} 실패 — ${e.message}`);
    }
  });

  log("");
  if (failed === 0) {
    ok(`${c.bold}완료: ${done}개 생성${c.reset} → ${outDir}`);
  } else {
    warn(`완료: 성공 ${done} / 실패 ${failed}`);
    for (const f of failures) err(`  ${f.name}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((e) => die(e.stack || e.message));
