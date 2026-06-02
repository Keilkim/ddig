'use strict';

/* ════════════════════════════════════════
   아이콘 헬퍼 — 손그림 아이콘(assets/icons/*.webp)을
   <img> 로 렌더링하고, 에셋이 없으면 이모지/텍스트로 폴백.

   ⚠️ 이 파일은 다른 html 템플릿(camera-view.js 등)보다 먼저
       로드돼야 한다 (app.html 최상단).
   생성: icon-gen — generate.mjs(PNG 마스터) → optimize.mjs(무손실 WebP) → assets/icons/<name>.webp
   ════════════════════════════════════════ */

var ICON_BASE = 'assets/icons/';

/* 런타임 쓰레기 분류 키 → 카테고리 아이콘 파일명 매핑
   (실제 분류 체계는 _CATEGORY_LABELS / gemini-api.js 기준) */
var CATEGORY_ICON_MAP = {
  plastic:   'cat-plastic',
  vinyl:     'cat-vinyl',
  styrofoam: 'cat-styrofoam',
  paper:     'cat-paper',
  paperpack: 'cat-paperpack',
  glass:     'cat-glass',
  can:       'cat-can',
  metal:     'cat-can',     // metal → 캔류와 동일 취급
  cigarette: 'cat-cigarette',
  organic:   'cat-other',   // organic → 기타와 동일 취급
  other:     'cat-other'
};

/* 이미지 로드 실패 시 폴백 처리.
   fallback 이 비어있으면 이미지 자체를 제거(텍스트 라벨만 남김),
   값이 있으면 이모지/텍스트 span 으로 교체한다.
   (fallback 값은 이모지·한글이라 따옴표가 없어 인라인 onerror 에 안전) */
function __iconFallback(img, fallback) {
  if (!fallback) {
    if (img && img.parentNode) img.parentNode.removeChild(img);
    return;
  }
  var span = document.createElement('span');
  span.className = 'app-icon-fallback';
  span.textContent = fallback;
  if (img && img.parentNode) img.parentNode.replaceChild(span, img);
}

/* 아이콘 <img> HTML 문자열 생성.
   opts: { cls, alt, fallback }
   - cls:      추가 클래스(사이즈/타일 지정)
   - alt:      대체 텍스트(기본 '')
   - fallback: 로드 실패 시 보여줄 이모지/텍스트(없으면 제거) */
function iconImg(name, opts) {
  opts = opts || {};
  var cls = 'app-icon' + (opts.cls ? ' ' + opts.cls : '');
  var alt = opts.alt || '';
  var fb = opts.fallback || '';
  return '<img class="' + cls + '" src="' + ICON_BASE + name + '.webp"' +
         ' alt="' + alt + '" onerror="__iconFallback(this,\'' + fb + '\')">';
}

/* 카테고리 키 → 아이콘 파일명 */
function getCategoryIconName(cat) {
  return CATEGORY_ICON_MAP[cat] || 'cat-other';
}

/* 카테고리 아이콘 <img> 문자열 (편의 래퍼) */
function categoryIconImg(cat, opts) {
  return iconImg(getCategoryIconName(cat), opts);
}
