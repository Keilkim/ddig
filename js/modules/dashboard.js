'use strict';

/* ════════════════════════════════════════
   대쉬보드 모듈 — 통계 & 차트
   ════════════════════════════════════════ */

var _chartTrashType = null;
var _routeMap = null;
var _myLocMarker = null;  // 현재 위치 마커 (맵 재생성 시 null로 리셋)
var _routeMapToken = 0;  // 비동기 위치 조회 경쟁 방지용 토큰
var _LIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

/* ─── Chart.js 라이트 테마 기본값 ─── */
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#4E5968';
  Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.06)';
  Chart.defaults.plugins.legend.labels.color = '#4E5968';
}

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

  try {
    // 해당 날짜 데이터 로드
    var dayPhotos = await loadPhotosByDate(targetDate);
    renderDayStats(dayPhotos);

    // 히스토리 필터 로드
    await loadFilteredHistory(AppState.filterPeriod);

    // 내 수집 목록 로드 (전체 사진)
    var allPhotos = await loadUserPhotos();
    AppState.photos = allPhotos;
    renderCollectionGrid(allPhotos);
  } catch (err) {
    console.error('대쉬보드 로드 실패:', err);
    var grid = document.getElementById('collection-grid');
    if (grid) grid.innerHTML = '<div class="collection-empty">데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
  }
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
  paper: '#D4956A', paperpack: '#00A94F', glass: '#30B0C7',
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

  // 빈 상태 메시지는 형제 요소로 토글 — canvas 자체를 제거하면
  // 이후 비어있지 않은 렌더가 detached 노드에 그려진다.
  var parent = canvas.parentElement;
  var emptyMsg = parent ? parent.querySelector('.chart-empty') : null;

  if (data.length === 0) {
    canvas.style.display = 'none';
    if (parent && !emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'chart-empty';
      emptyMsg.textContent = '데이터 없음';
      parent.appendChild(emptyMsg);
    }
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';
  canvas.style.display = '';

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

  var token = ++_routeMapToken;  // 이 호출의 토큰

  var points = [];
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].latitude && photos[i].longitude) {
      points.push([photos[i].latitude, photos[i].longitude]);
    }
  }

  if (_routeMap) {
    _routeMap.remove();
    _routeMap = null;
    _myLocMarker = null;  // 마커는 이전 맵에 종속 — 함께 폐기
  }
  // Leaflet 내부 참조 제거 — 컨테이너 재사용 시 "already initialized" 방지
  delete mapEl._leaflet_id;

  if (points.length === 0) {
    mapEl.innerHTML = '';
    getCurrentLocation().then(function(loc) {
      // 늦게 resolve된 콜백이 최신 렌더만 반영하도록 가드 (맵 중복 생성 방지)
      if (token !== _routeMapToken) return;
      if (!loc.latitude || !loc.longitude) {
        mapEl.innerHTML = '<div class="chart-empty" style="height:100%;display:flex;align-items:center;justify-content:center">위치를 가져올 수 없습니다</div>';
        return;
      }
      if (_routeMap) { _routeMap.remove(); _routeMap = null; }
      delete mapEl._leaflet_id;
      mapEl.innerHTML = '';
      _myLocMarker = null;
      _routeMap = L.map(mapEl, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
        doubleClickZoom: false
      });
      L.tileLayer(_LIGHT_TILE_URL, { maxZoom: 19 }).addTo(_routeMap);
      _routeMap.setView([loc.latitude, loc.longitude], 15);
      setMyLocationMarker(_routeMap, loc);
      addRecenterControl(_routeMap, mapEl);
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
    doubleClickZoom: true
  });
  L.tileLayer(_LIGHT_TILE_URL, { maxZoom: 19 }).addTo(_routeMap);

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

  // 내 위치로 버튼 (우측 상단)
  addRecenterControl(_routeMap, mapEl);

  // 경로 선
  if (points.length > 1) {
    L.polyline(points, { color: '#00A94F', weight: 3, opacity: 0.85 }).addTo(_routeMap);
  }

  // 쓰레기 마커
  for (var j = 0; j < photos.length; j++) {
    if (photos[j].latitude && photos[j].longitude) {
      var icon = L.divIcon({
        html: '<span style="display:block;width:10px;height:10px;background:#00A94F;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,169,79,0.45)"></span>',
        className: 'trash-marker',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });
      L.marker([photos[j].latitude, photos[j].longitude], { icon: icon }).addTo(_routeMap);
    }
  }

  // 포인트 1개면 fitBounds가 zero-area로 과도 확대 → setView로 처리
  if (points.length === 1) {
    _routeMap.setView(points[0], 16);
  } else {
    _routeMap.fitBounds(points, { padding: [20, 20] });
  }

  // 현재 위치(파란 점)도 함께 표시 — 뷰는 쓰레기 경로 기준 유지
  // (위치가 화면 밖이면 우측 상단 "내 위치로" 버튼으로 이동)
  getCurrentLocation().then(function(loc) {
    if (token !== _routeMapToken || !_routeMap) return;  // 렌더 경쟁/맵 폐기 가드
    if (!loc.latitude || !loc.longitude) return;
    setMyLocationMarker(_routeMap, loc);
  });
}

/* ─── 현재 위치 마커 (있으면 이동, 없으면 생성) ─── */
function setMyLocationMarker(map, loc) {
  var ll = [loc.latitude, loc.longitude];
  if (_myLocMarker) {
    _myLocMarker.setLatLng(ll);
    return;
  }
  var icon = L.divIcon({
    html: '<span style="display:block;width:14px;height:14px;background:#3182F6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(49,130,246,0.45)"></span>',
    className: 'current-loc-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
  _myLocMarker = L.marker(ll, { icon: icon, zIndexOffset: 1000 }).addTo(map);
}

/* ─── "내 위치로" 버튼 (우측 상단) ─── */
// 클릭 시 현재 위치를 다시 조회해 지도를 그 지점으로 이동/확대하고 내 위치 마커를 갱신
function addRecenterControl(map, mapEl) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'recenter-btn';
  btn.setAttribute('aria-label', '내 위치로');
  btn.title = '내 위치로';
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3.2"></circle>' +
      '<line x1="12" y1="2" x2="12" y2="5"></line>' +
      '<line x1="12" y1="19" x2="12" y2="22"></line>' +
      '<line x1="2" y1="12" x2="5" y2="12"></line>' +
      '<line x1="19" y1="12" x2="22" y2="12"></line>' +
    '</svg>';

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (btn.classList.contains('loading')) return;  // 중복 클릭 방지
    btn.classList.add('loading');
    getCurrentLocation().then(function(loc) {
      btn.classList.remove('loading');
      if (!loc.latitude || !loc.longitude) {
        alert('현재 위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
        return;
      }
      setMyLocationMarker(map, loc);
      var zoom = Math.max(map.getZoom(), 16);
      map.setView([loc.latitude, loc.longitude], zoom, { animate: true });
    });
  });

  mapEl.appendChild(btn);
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
