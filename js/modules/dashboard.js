'use strict';

/* ════════════════════════════════════════
   대쉬보드 모듈 — 통계 & 차트
   ════════════════════════════════════════ */

var _chartTrashType = null;
var _routeMap = null;

/* ─── 대쉬보드 로드 ─── */
async function loadDashboard(date) {
  var targetDate = date || new Date();
  AppState.selectedDate = targetDate;

  // 날짜 표시
  var dateText = document.getElementById('dashboard-date-text');
  if (dateText) {
    var today = new Date();
    if (targetDate.toDateString() === today.toDateString()) {
      dateText.textContent = '오늘';
    } else {
      dateText.textContent = formatDate(targetDate);
    }
  }

  // 해당 날짜 데이터 로드
  var dayPhotos = await loadPhotosByDate(targetDate);
  renderDayStats(dayPhotos);

  // 히스토리 필터 로드
  await loadFilteredHistory(AppState.filterPeriod);

  // 내 수집 목록 로드
  renderCollectionGrid(AppState.photos || []);
}

/* ─── 일일 통계 렌더링 ─── */
function renderDayStats(photos) {
  // 주운 쓰레기 수
  var countEl = document.getElementById('trash-count');
  if (countEl) countEl.textContent = photos.length;

  // 오염도 저감
  var pollutionEl = document.getElementById('pollution-level');
  if (pollutionEl) {
    var totalImpact = 0;
    for (var i = 0; i < photos.length; i++) {
      totalImpact += Number(photos[i].pollution_impact) || 0;
    }
    pollutionEl.textContent = totalImpact > 0 ? totalImpact.toFixed(1) : '-';
  }

  // 이동 거리
  var distanceEl = document.getElementById('distance-value');
  if (distanceEl) {
    var dist = calcDistance(photos);
    distanceEl.textContent = dist.toFixed(2) + ' km';
  }

  // 쓰레기 유형 차트
  renderTrashTypeChart(photos);

  // 루트맵
  renderRouteMap(photos);
}

/* ─── 카테고리 아이콘 맵 ─── */
var _CATEGORY_ICONS = {
  plastic: '\u{1F9F4}',
  paper: '\u{1F4C4}',
  glass: '\u{1FAD9}',
  metal: '\u{1F96B}',
  organic: '\u{1F342}',
  cigarette: '\u{1F6AC}',
  other: '\u{1F5D1}'
};

/* ─── 쓰레기 유형 도넛 차트 ─── */
function renderTrashTypeChart(photos) {
  var canvas = document.getElementById('chart-trash-type');
  if (!canvas) return;

  var categories = {};
  for (var i = 0; i < photos.length; i++) {
    var cat = photos[i].trash_category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  var keys = [];
  var labels = [];
  var data = [];
  var colors = [];
  var colorMap = {
    plastic: '#4A90D9', paper: '#D4956A', glass: '#6BAF7B',
    metal: '#C4C4C4', organic: '#8B6914', cigarette: '#D46B6B', other: '#8A8A8A'
  };
  var labelMap = {
    plastic: '플라스틱', paper: '종이', glass: '유리',
    metal: '금속', organic: '음식물', cigarette: '담배꽁초', other: '기타'
  };

  for (var key in categories) {
    keys.push(key);
    labels.push((_CATEGORY_ICONS[key] || '') + ' ' + (labelMap[key] || key));
    data.push(categories[key]);
    colors.push(colorMap[key] || '#8A8A8A');
  }

  if (_chartTrashType) _chartTrashType.destroy();

  if (data.length === 0) {
    canvas.parentElement.innerHTML = '<div class="chart-empty">데이터 없음</div>';
    return;
  }

  _chartTrashType = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11 },
            padding: 10,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      }
    }
  });
}

/* ─── 루트맵 (Leaflet) ─── */
function renderRouteMap(photos) {
  var mapEl = document.getElementById('route-map');
  if (!mapEl) return;

  var points = [];
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].latitude && photos[i].longitude) {
      points.push([photos[i].latitude, photos[i].longitude]);
    }
  }

  if (_routeMap) {
    _routeMap.remove();
    _routeMap = null;
  }

  if (points.length === 0) {
    mapEl.innerHTML = '<div class="chart-empty" style="height:100%;display:flex;align-items:center;justify-content:center">경로 데이터 없음</div>';
    return;
  }

  mapEl.innerHTML = '';
  _routeMap = L.map(mapEl, { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_routeMap);

  // 경로 선
  if (points.length > 1) {
    L.polyline(points, { color: '#4ecdc4', weight: 3, opacity: 0.7 }).addTo(_routeMap);
  }

  // 쓰레기 마커
  for (var j = 0; j < photos.length; j++) {
    if (photos[j].latitude && photos[j].longitude) {
      var icon = L.divIcon({
        html: '<span style="display:block;width:10px;height:10px;background:#ff6b6b;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>',
        className: 'trash-marker',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });
      L.marker([photos[j].latitude, photos[j].longitude], { icon: icon }).addTo(_routeMap);
    }
  }

  _routeMap.fitBounds(points, { padding: [20, 20] });
}

/* ─── GPS 포인트 간 거리 계산 (km) ─── */
function calcDistance(photos) {
  var total = 0;
  var points = [];
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].latitude && photos[i].longitude) {
      points.push({ lat: photos[i].latitude, lng: photos[i].longitude });
    }
  }
  for (var j = 1; j < points.length; j++) {
    total += haversine(points[j - 1], points[j]);
  }
  return total;
}

function haversine(a, b) {
  var R = 6371;
  var dLat = (b.lat - a.lat) * Math.PI / 180;
  var dLng = (b.lng - a.lng) * Math.PI / 180;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* ─── 내 수집 목록 렌더링 ─── */
function renderCollectionGrid(photos) {
  var grid = document.getElementById('collection-grid');
  if (!grid) return;

  if (!photos || photos.length === 0) {
    grid.innerHTML = '<div class="collection-empty">아직 수집한 쓰레기가 없습니다</div>';
    return;
  }

  var labelMap = {
    plastic: '플라스틱', paper: '종이', glass: '유리',
    metal: '금속', organic: '음식물', cigarette: '담배꽁초', other: '기타'
  };

  var html = '';
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    var url = getPhotoUrl(p.storage_path);
    var label = labelMap[p.trash_category] || '';
    html +=
      '<div class="collection-card">' +
        '<img src="' + url + '" alt="" loading="lazy">' +
        (label ? '<div class="collection-card-label">' + label + '</div>' : '') +
      '</div>';
  }
  grid.innerHTML = html;
}

/* ─── 날짜 포맷 ─── */
function formatDate(d) {
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}
