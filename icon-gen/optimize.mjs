#!/usr/bin/env node
/**
 * optimize — 1024px PNG 마스터(icon-gen/output/)를 표시 크기에 맞춘
 *            무손실 WebP 로 변환해 앱 배포 경로(assets/icons/)에 떨어뜨린다.
 *
 *   node optimize.mjs            전체 변환 (있어도 덮어씀)
 *   node optimize.mjs --only trophy,pin
 *
 * 요구: cwebp (Homebrew: `brew install webp`)
 * - 무손실(-lossless)이라 화질 저하 없음. 용량 절감은 "해상도 다운스케일 + WebP".
 * - alpha(투명) 보존.
 *
 * 표시 크기 기준 해상도(레티나 3배+ 여유):
 *   큰 아이콘(빈 화면/카메라 placeholder, 64~72px 표시) → 256px
 *   작은 아이콘(메달/탭/아바타/카테고리, 16~26px 표시)   → 128px
 */
'use strict';

import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER_DIR = join(__dirname, 'output');          // 1024 PNG 마스터 (gitignore)
const OUT_DIR = resolve(__dirname, '..', 'assets', 'icons'); // 배포용 webp

// 크게 표시되는 아이콘만 256px, 나머지는 128px
const LARGE = new Set(['trophy', 'pin', 'warning', 'camera']);
const sizeFor = (name) => (LARGE.has(name) ? 256 : 128);

function die(msg) { console.error('\n✖ ' + msg + '\n'); process.exit(1); }

// cwebp 존재 확인
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
} catch (_) {
  die('cwebp 가 없습니다. 설치: brew install webp');
}

if (!existsSync(MASTER_DIR)) die('마스터 폴더가 없습니다: ' + MASTER_DIR + '\n  먼저 node generate.mjs 로 PNG 마스터를 생성하세요.');
mkdirSync(OUT_DIR, { recursive: true });

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const onlySet = process.argv.includes('--only') ? new Set(only) : null;

let masters = readdirSync(MASTER_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
if (onlySet) masters = masters.filter((f) => onlySet.has(f.replace(/\.png$/i, '')));

if (masters.length === 0) die('변환할 PNG 마스터가 없습니다 (' + MASTER_DIR + ').');

console.log('\n무손실 WebP 변환 — ' + masters.length + '개\n마스터: ' + MASTER_DIR + '\n출력:   ' + OUT_DIR + '\n');

let done = 0, totalIn = 0, totalOut = 0;
for (const file of masters) {
  const name = file.replace(/\.png$/i, '');
  const inPath = join(MASTER_DIR, file);
  const outPath = join(OUT_DIR, name + '.webp');
  const px = sizeFor(name);
  try {
    execFileSync('cwebp', ['-quiet', '-lossless', '-resize', String(px), '0', inPath, '-o', outPath]);
    const inSz = readFileSync(inPath).length;
    const outSz = readFileSync(outPath).length;
    totalIn += inSz; totalOut += outSz; done++;
    console.log('  ✓ ' + name + '.webp  ' + px + 'px  ' + (outSz / 1024).toFixed(1) + ' KB  (png ' + (inSz / 1024).toFixed(0) + ' KB)');
  } catch (e) {
    console.error('  ✗ ' + name + ' 실패 — ' + e.message);
  }
}

console.log('\n완료: ' + done + '/' + masters.length +
  '  ·  ' + (totalIn / 1024 / 1024).toFixed(1) + ' MB → ' + (totalOut / 1024).toFixed(0) + ' KB\n');
