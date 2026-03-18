'use strict';

/* ════════════════════════════════════════
   히스토리 필터링 모듈
   ════════════════════════════════════════ */

var _chartHistoryType = null;
var _chartHistoryTrend = null;

/* ─── 필터 버튼 클릭 ─── */
async function setFilter(periodKey) {
  AppState.filterPeriod = periodKey;

  // 활성 버튼 UI
  var btns = document.querySelectorAll('.filter-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('filter-active', btns[i].dataset.period === periodKey);
  }

  await loadFilteredHistory(periodKey);
}

/* ─── 필터링된 히스토리 로드 & 렌더 ─── */
async function loadFilteredHistory(periodKey) {
  var photos = await loadPhotosByPeriod(periodKey);
  renderHistoryTypeChart(photos);
  renderHistoryTrendChart(photos);
}

/* ─── 히스토리 쓰레기 유형 차트 ─── */
function renderHistoryTypeChart(photos) {
  var canvas = document.getElementById('chart-history-type');
  if (!canvas) return;

  var categories = {};
  var iconMap = {
    plastic: '\u{1F9F4}', paper: '\u{1F4C4}', glass: '\u{1FAD9}',
    metal: '\u{1F96B}', organic: '\u{1F342}', cigarette: '\u{1F6AC}', other: '\u{1F5D1}'
  };
  var labelMap = {
    plastic: '플라스틱', paper: '종이', glass: '유리',
    metal: '금속', organic: '음식물', cigarette: '담배꽁초', other: '기타'
  };
  var colorMap = {
    plastic: '#4A90D9', paper: '#D4956A', glass: '#6BAF7B',
    metal: '#C4C4C4', organic: '#8B6914', cigarette: '#D46B6B', other: '#8A8A8A'
  };

  for (var i = 0; i < photos.length; i++) {
    var cat = photos[i].trash_category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  var labels = [], data = [], colors = [];
  for (var key in categories) {
    labels.push((iconMap[key] || '') + ' ' + (labelMap[key] || key));
    data.push(categories[key]);
    colors.push(colorMap[key] || '#8A8A8A');
  }

  if (_chartHistoryType) _chartHistoryType.destroy();

  if (data.length === 0) return;

  _chartHistoryType = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: colors, borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

/* ─── 히스토리 수거 추이 차트 ─── */
function renderHistoryTrendChart(photos) {
  var canvas = document.getElementById('chart-history-trend');
  if (!canvas) return;

  // 날짜별 그룹핑
  var dailyCounts = {};
  for (var i = 0; i < photos.length; i++) {
    var day = photos[i].captured_at.substring(0, 10);
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }

  var sortedDays = Object.keys(dailyCounts).sort();
  var labels = [];
  var data = [];
  for (var j = 0; j < sortedDays.length; j++) {
    labels.push(sortedDays[j].substring(5)); // MM-DD
    data.push(dailyCounts[sortedDays[j]]);
  }

  if (_chartHistoryTrend) _chartHistoryTrend.destroy();

  if (data.length === 0) return;

  _chartHistoryTrend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderColor: '#4A90D9',
        backgroundColor: 'rgba(74, 144, 217, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}
