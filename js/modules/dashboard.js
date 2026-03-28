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

  // 내 수집 목록 로드 (전체 사진)
  var allPhotos = await loadUserPhotos();
  AppState.photos = allPhotos;
  renderCollectionGrid(allPhotos);
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

/* ─── 환경부 분류 카테고리 공통 맵 ─── */
var _CATEGORY_LABELS = {
  plastic: '플라스틱', vinyl: '비닐류', styrofoam: '스티로폼',
  paper: '종이류', paperpack: '종이팩', glass: '유리류',
  can: '캔류', cigarette: '담배꽁초', other: '기타',
  metal: '캔류', organic: '기타'
};
var _CATEGORY_COLORS = {
  plastic: '#007AFF', vinyl: '#AF52DE', styrofoam: '#FF9500',
  paper: '#D4956A', paperpack: '#34C759', glass: '#30B0C7',
  can: '#8E8E93', cigarette: '#FF3B30', other: '#636366',
  metal: '#8E8E93', organic: '#636366'
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

  for (var key in categories) {
    keys.push(key);
    labels.push(_CATEGORY_LABELS[key] || key);
    data.push(categories[key]);
    colors.push(_CATEGORY_COLORS[key] || '#636366');
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
    mapEl.innerHTML = '';
    getCurrentLocation().then(function(loc) {
      if (!loc.latitude || !loc.longitude) {
        mapEl.innerHTML = '<div class="chart-empty" style="height:100%;display:flex;align-items:center;justify-content:center">위치를 가져올 수 없습니다</div>';
        return;
      }
      if (_routeMap) { _routeMap.remove(); _routeMap = null; }
      _routeMap = L.map(mapEl, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
        doubleClickZoom: false
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_routeMap);
      _routeMap.setView([loc.latitude, loc.longitude], 15);
      var icon = L.divIcon({
        html: '<span style="display:block;width:14px;height:14px;background:#007AFF;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,122,255,0.5)"></span>',
        className: 'current-loc-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([loc.latitude, loc.longitude], { icon: icon }).addTo(_routeMap);
    });
    return;
  }

  mapEl.innerHTML = '';
  _routeMap = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    touchZoom: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    pinchZoom: true
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_routeMap);

  /* ─── 줌 컨트롤 UI (오른쪽) ─── */
  var zoomWrap = document.createElement('div');
  zoomWrap.className = 'route-map-zoom-ctrl';

  var btnIn = document.createElement('button');
  btnIn.className = 'zoom-btn';
  btnIn.textContent = '+';
  btnIn.addEventListener('click', function(e) { e.stopPropagation(); _routeMap.zoomIn(); });

  var lvl = document.createElement('div');
  lvl.className = 'zoom-level';
  lvl.textContent = _routeMap.getZoom();

  var btnOut = document.createElement('button');
  btnOut.className = 'zoom-btn';
  btnOut.textContent = '−';
  btnOut.addEventListener('click', function(e) { e.stopPropagation(); _routeMap.zoomOut(); });

  zoomWrap.appendChild(btnIn);
  zoomWrap.appendChild(lvl);
  zoomWrap.appendChild(btnOut);
  mapEl.appendChild(zoomWrap);

  _routeMap.on('zoomend', function() {
    lvl.textContent = _routeMap.getZoom();
  });

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

  var html = '';
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    var url = getPhotoUrl(p.storage_path);
    var label = _CATEGORY_LABELS[p.trash_category] || '';
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
