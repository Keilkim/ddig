'use strict';

/* ════════════════════════════════════════
   전역 상태 관리
   ════════════════════════════════════════ */

var AppState = {
  user: null,
  permissionGranted: false,
  currentView: 'plogging',
  selectedDate: null,
  filterPeriod: '1m',
  cameraStream: null,
  cameraActive: false,
  photos: [],
  dashboardData: null,
  rankingData: null,
  comparisonTarget: null,
  districtGeoJSON: null
};

/* ════════════════════════════════════════
   공통 유틸 헬퍼
   ════════════════════════════════════════ */

/* ─── TIMESTAMPTZ(UTC) → 로컬 YYYY-MM-DD ───
   captured_at은 UTC ISO 문자열이므로 substring(0,10)으로 자르면
   UTC 날짜가 나온다. 날짜 필터(setHours)는 로컬 기준이므로
   그룹핑도 반드시 로컬 기준으로 통일해야 한다(KST 00~09시 어긋남 방지). */
function localDayKey(ts) {
  if (!ts) return 'unknown';
  var d = (ts instanceof Date) ? ts : new Date(ts);
  if (isNaN(d.getTime())) return 'unknown';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/* ─── HTML 텍스트 컨텍스트 이스케이프 (XSS 방지) ─── */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── 인라인 핸들러(onclick="fn('VALUE')")용 이스케이프 ───
   먼저 JS 문자열 이스케이프 후 HTML 속성 이스케이프를 적용해
   따옴표/꺾쇠가 핸들러를 깨거나 마크업을 주입하지 못하게 한다. */
function escapeJsAttr(str) {
  if (str == null) return '';
  var jsEscaped = String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]/g, ' ');
  return escapeHtml(jsEscaped);
}
