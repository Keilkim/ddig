'use strict';

/* ════════════════════════════════════════
   상대방 경로 뷰 모듈
   ════════════════════════════════════════ */

var _comparisonMap = null;
var _DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/* ─── 상대방 경로 맵 열기 ─── */
async function openComparisonMap(targetUserId, targetDisplayName) {
  var popup = document.getElementById('comparison-popup');
  if (!popup) return;
  popup.classList.add('active');

  var title = document.getElementById('comparison-title');
  if (title) title.textContent = targetDisplayName + '님의 활동';

  var userBar = document.getElementById('comparison-user-bar');
  if (userBar) {
    userBar.innerHTML =
      '<div class="comparison-user"><span class="comparison-user-dot" style="background:#34C759"></span>' + targetDisplayName + '의 전체 경로</div>';
  }

  var mapEl = document.getElementById('comparison-map');
  if (!mapEl) return;
  mapEl.innerHTML = '<div class="ranking-empty"><div class="ranking-spinner"></div><div style="margin-top:12px;font-size:12px;color:var(--color-tertiary)">경로 불러오는 중...</div></div>';

  // 데이터 로드
  var results = await Promise.all([
    loadUserRoutes(targetUserId),
    loadUserDistrictStats(targetUserId)
  ]);

  var targetRoutes = results[0];
  var targetDistrictStats = results[1];

  // 날짜별 그룹핑 (captured_at 기준)
  var dayGroups = {};  // { 'YYYY-MM-DD': [[lat,lng], ...] }
  var allPoints = [];
  for (var i = 0; i < targetRoutes.length; i++) {
    var r = targetRoutes[i];
    var lat = Number(r.latitude);
    var lng = Number(r.longitude);
    if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      var dayKey = r.captured_at ? r.captured_at.substring(0, 10) : 'unknown';
      if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
      dayGroups[dayKey].push([lat, lng]);
      allPoints.push([lat, lng]);
    }
  }

  var dayKeys = Object.keys(dayGroups).sort();

  if (allPoints.length === 0) {
    mapEl.innerHTML =
      '<div class="ranking-empty">' +
        '<div style="font-size:40px;margin-bottom:12px">📍</div>' +
        '<div>' + targetDisplayName + '님의 경로 데이터가 없습니다</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">GPS 정보가 있는 플로깅 기록이 필요합니다</div>' +
      '</div>';
    renderComparisonStats(0, 0);
    return;
  }

  // 날짜별 색상 팔레트
  var _dayColors = [
    '#34C759','#FF9F0A','#0A84FF','#FF375F','#BF5AF2',
    '#FFD60A','#64D2FF','#FF6482','#30D158','#AC8E68'
  ];

  // 맵 렌더링 — 컨테이너 크기 보장
  mapEl.style.minHeight = '300px';
  if (_comparisonMap) {
    try { _comparisonMap.remove(); } catch(e) { /* 이미 제거됨 */ }
    _comparisonMap = null;
  }
  // Leaflet 내부 참조 제거 후 컨테이너 초기화
  delete mapEl._leaflet_id;
  mapEl.innerHTML = '';

  // 팝업 렌더링 완료 대기 후 맵 생성
  await new Promise(function(r) { setTimeout(r, 100); });

  _comparisonMap = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    touchZoom: true,
    scrollWheelZoom: true,
    doubleClickZoom: true
  });
  L.tileLayer(_DARK_TILE_URL, { maxZoom: 19 }).addTo(_comparisonMap);
  _comparisonMap.invalidateSize();

  // 시군구 바운더리
  var geojson = _districtGeoJSON || AppState.districtGeoJSON;
  if (geojson) {
    var districtVisits = {};
    var maxVisits = 1;
    if (targetDistrictStats) {
      for (var d = 0; d < targetDistrictStats.length; d++) {
        var code = targetDistrictStats[d].district_code;
        var count = Number(targetDistrictStats[d].visit_count) || 0;
        districtVisits[code] = count;
        if (count > maxVisits) maxVisits = count;
      }
    }

    L.geoJSON(geojson, {
      style: function(feature) {
        var code = feature.properties.SIG_CD;
        var visits = districtVisits[code] || 0;
        if (visits > 0) {
          var opacity = 0.15 + (visits / maxVisits) * 0.4;
          return { color: '#34C759', weight: 2, fillColor: '#34C759', fillOpacity: opacity };
        }
        return { color: 'rgba(255,255,255,0.08)', weight: 0.5, fillColor: 'transparent', fillOpacity: 0 };
      },
      onEachFeature: function(feature, layer) {
        var code = feature.properties.SIG_CD;
        if (districtVisits[code]) {
          layer.bindTooltip(
            feature.properties.SIG_KOR_NM + ' (' + districtVisits[code] + '회)',
            { sticky: true, className: 'district-tooltip' }
          );
        }
      }
    }).addTo(_comparisonMap);
  }

  // 경로 전용 pane (GeoJSON 위에 표시)
  _comparisonMap.createPane('routePane');
  _comparisonMap.getPane('routePane').style.zIndex = 450;
  _comparisonMap.createPane('markerPane2');
  _comparisonMap.getPane('markerPane2').style.zIndex = 460;

  // 날짜별 경로 그리기
  for (var di = 0; di < dayKeys.length; di++) {
    var dayPts = dayGroups[dayKeys[di]];
    var color = _dayColors[di % _dayColors.length];

    // 경로선
    if (dayPts.length > 1) {
      L.polyline(dayPts, { color: color, weight: 4, opacity: 0.9, pane: 'routePane' }).addTo(_comparisonMap);
    }
    // 마커
    for (var k = 0; k < dayPts.length; k++) {
      L.circleMarker(dayPts[k], {
        radius: 6, fillColor: color, color: '#fff',
        weight: 2, fillOpacity: 1, pane: 'markerPane2'
      }).addTo(_comparisonMap);
    }
  }

  // 레전드 — 날짜별 색상 표시
  var legendEl = popup.querySelector('.comparison-legend');
  if (legendEl) {
    var legendHtml = '';
    for (var li = 0; li < dayKeys.length; li++) {
      var cnt = dayGroups[dayKeys[li]].length;
      legendHtml += '<span class="legend-item"><span class="legend-dot" style="background:' + _dayColors[li % _dayColors.length] + '"></span>' + cnt + '개</span>';
    }
    legendEl.innerHTML = legendHtml;
  }

  // fitBounds — 유효한 좌표만 사용 + 안전하게 시도
  var validBounds = L.latLngBounds(allPoints.map(function(p) { return L.latLng(p[0], p[1]); }));
  var doBounds = function() {
    if (!_comparisonMap) return;
    try {
      _comparisonMap.invalidateSize();
      if (validBounds.isValid()) {
        _comparisonMap.fitBounds(validBounds, { padding: [30, 30] });
      }
    } catch(e) { /* 맵 컨테이너 크기 문제 무시 */ }
  };
  setTimeout(doBounds, 100);
  setTimeout(doBounds, 400);
  setTimeout(doBounds, 800);

  // 거리 계산 (날짜별로 분리하여 합산)
  var totalDist = 0;
  for (var di2 = 0; di2 < dayKeys.length; di2++) {
    var dPts = dayGroups[dayKeys[di2]];
    for (var j = 1; j < dPts.length; j++) {
      totalDist += haversine(
        { lat: dPts[j - 1][0], lng: dPts[j - 1][1] },
        { lat: dPts[j][0], lng: dPts[j][1] }
      );
    }
  }

  renderComparisonStats(targetRoutes.length, totalDist);
}

/* ─── 통계 렌더링 ─── */
function renderComparisonStats(count, dist) {
  var statsEl = document.getElementById('comparison-stats');
  if (!statsEl) return;

  statsEl.innerHTML =
    '<div class="comparison-stat-row">' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">수거량</div>' +
        '<div class="comparison-stat-card-value">' + count + '<span class="comparison-stat-unit">개</span></div>' +
      '</div>' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">이동거리</div>' +
        '<div class="comparison-stat-card-value">' + dist.toFixed(2) + '<span class="comparison-stat-unit">km</span></div>' +
      '</div>' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">점수</div>' +
        '<div class="comparison-stat-card-value">' + (count * 10).toLocaleString() + '<span class="comparison-stat-unit">pt</span></div>' +
      '</div>' +
    '</div>';
}

/* ─── 맵 닫기 ─── */
function closeComparisonMap() {
  var popup = document.getElementById('comparison-popup');
  if (popup) popup.classList.remove('active');

  if (_comparisonMap) {
    try { _comparisonMap.remove(); } catch(e) { /* 이미 제거됨 */ }
    _comparisonMap = null;
  }
  var mapEl = document.getElementById('comparison-map');
  if (mapEl) {
    delete mapEl._leaflet_id;
    mapEl.innerHTML = '';
  }
}
