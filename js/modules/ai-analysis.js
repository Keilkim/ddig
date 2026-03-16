'use strict';

/* ════════════════════════════════════════
   AI 분석 모듈 — 종합 플로깅 데이터 분석
   ════════════════════════════════════════ */

async function runAIAnalysis() {
  var loadingEl = document.getElementById('ai-loading');
  var resultEl = document.getElementById('ai-result');
  if (!loadingEl || !resultEl) return;

  loadingEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  resultEl.innerHTML = '';

  try {
    // 전체 데이터 로드
    var photos = await loadUserPhotos();

    if (photos.length === 0) {
      resultEl.innerHTML = '<p>분석할 데이터가 없습니다. 플로깅 활동을 시작해보세요!</p>';
      loadingEl.classList.add('hidden');
      resultEl.classList.remove('hidden');
      return;
    }

    // 데이터 요약 생성
    var summary = buildDataSummary(photos);

    // Gemini에 분석 요청
    var analysis = await requestAIAnalysis(summary);

    resultEl.innerHTML = analysis;
    loadingEl.classList.add('hidden');
    resultEl.classList.remove('hidden');

  } catch (err) {
    console.error('AI 분석 오류:', err);
    resultEl.innerHTML = '<p>분석 중 오류가 발생했습니다. 다시 시도해주세요.</p>';
    loadingEl.classList.add('hidden');
    resultEl.classList.remove('hidden');
  }
}

/* ─── 데이터 요약 생성 ─── */
function buildDataSummary(photos) {
  var categories = {};
  var totalPollution = 0;
  var dates = [];
  var locations = [];

  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    var cat = p.trash_category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
    totalPollution += Number(p.pollution_impact) || 0;
    dates.push(p.captured_at.substring(0, 10));
    if (p.latitude && p.longitude) {
      locations.push({ lat: p.latitude, lng: p.longitude });
    }
  }

  var uniqueDates = [];
  var seen = {};
  for (var j = 0; j < dates.length; j++) {
    if (!seen[dates[j]]) { uniqueDates.push(dates[j]); seen[dates[j]] = true; }
  }

  return {
    totalPhotos: photos.length,
    categories: categories,
    totalPollutionImpact: totalPollution,
    activeDays: uniqueDates.length,
    dateRange: uniqueDates.length > 0
      ? uniqueDates[0] + ' ~ ' + uniqueDates[uniqueDates.length - 1]
      : '없음',
    locationCount: locations.length
  };
}

/* ─── Gemini AI 분석 요청 ─── */
async function requestAIAnalysis(summary) {
  if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
    return '<p>Gemini API 키가 설정되지 않았습니다.</p>';
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  var prompt =
    '당신은 플로깅(조깅하며 쓰레기 줍기) 활동 분석 전문가입니다.\n' +
    '아래 사용자의 플로깅 데이터를 분석하여 한국어로 보고서를 작성해주세요.\n\n' +
    '=== 데이터 요약 ===\n' +
    '총 수거 쓰레기: ' + summary.totalPhotos + '개\n' +
    '활동 일수: ' + summary.activeDays + '일\n' +
    '활동 기간: ' + summary.dateRange + '\n' +
    '총 오염도 저감 점수: ' + summary.totalPollutionImpact.toFixed(1) + '\n' +
    'GPS 기록 수: ' + summary.locationCount + '건\n' +
    '쓰레기 유형별 수량: ' + JSON.stringify(summary.categories) + '\n\n' +
    '=== 보고서 형식 ===\n' +
    'HTML 형식으로 작성해주세요 (h3, p, ul, li 태그 사용).\n' +
    '다음 섹션을 포함하세요:\n' +
    '1. 활동 요약\n' +
    '2. 쓰레기 유형 분석\n' +
    '3. 환경 영향 평가\n' +
    '4. 개선 제안\n' +
    '5. 응원 메시지';

  var body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  };

  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) return '<p>AI 분석 요청 실패 (HTTP ' + response.status + ')</p>';

  var result = await response.json();
  var text = result.candidates[0].content.parts[0].text;

  // 마크다운 코드블록 제거
  text = text.replace(/```html\n?/g, '').replace(/```\n?/g, '');
  return text;
}
