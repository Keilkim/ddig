'use strict';

/* ════════════════════════════════════════
   상대방 경로 뷰 모듈
   ════════════════════════════════════════ */

var _comparisonMap = null;

/* ─── 다크 맵 타일 URL ─── */
var _DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/* ─── 날짜별 경로 색상 팔레트 ─── */
var _ROUTE_COLORS = [
  '#34C759', '#5AC8FA', '#FFD60A', '#FF9F0A',
  '#BF5AF2', '#FF375F', '#64D2FF', '#30D158'
];

/* ─── 포인트를 날짜별로 그룹핑 ─── */
function _groupByDate(routes) {
  var groups = {};
  var order = [];
  for (var i = 0; i < routes.length; i++) {
    var r = routes[i];
    if (!r.latitude || !r.longitude) continue;
    var dayKey = (r.captured_at || '').substring(0, 10);
    if (!dayKey) continue;
    if (!groups[dayKey]) {
      groups[dayKey] = [];
      order.push(dayKey);
    }
    groups[dayKey].push([r.latitude, r.longitude]);
  }
  order.sort();
  return { groups: groups, order: order };
}

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
      '<div class="comparison-user"><span class="comparison-user-dot" style="background:#34C759"></span>' + targetDisplayName + '의 경로</div>';
  }

  var mapEl = document.getElementById('comparison-map');
  if (!mapEl) return;
  mapEl.innerHTML = '<div class="ranking-empty"><div class="ranking-spinner"></div><div style="margin-top:12px;font-size:12px;color:var(--color-tertiary)">경로 불러오는 중...</div></div>';

  var isSelf = AppState.user && targetUserId === AppState.user.id;
  var results = await Promise.all([
    isSelf ? loadUserPhotos() : loadUserRoutes(targetUserId),
    isSelf ? loadUserDistrictStats(AppState.user.id) : loadUserDistrictStats(targetUserId)
  ]);

  var targetRoutes = results[0];
  var targetDistrictStats = results[1];

  // 경로 데이터 없으면 안내
  if (!targetRoutes || targetRoutes.length === 0) {
    mapEl.innerHTML =
      '<div class="ranking-empty">' +
        '<div style="font-size:40px;margin-bottom:12px">📍</div>' +
        '<div>' + targetDisplayName + '님의 경로 데이터가 없습니다</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">GPS 정보가 있는 플로깅 기록이 필요합니다</div>' +
      '</div>';
    renderComparisonStats([], targetDisplayName);
    return;
  }

  // 날짜별 그룹핑
  var dated = _groupByDate(targetRoutes);
  var dayGroups = dated.groups;
  var dayOrder = dated.order;

  // 맵 렌더링
  mapEl.innerHTML = '';
  if (_comparisonMap) { _comparisonMap.remove(); _comparisonMap = null; }

  _comparisonMap = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    touchZoom: true,
    scrollWheelZoom: true,
    doubleClickZoom: true
  });
  L.tileLayer(_DARK_TILE_URL, { maxZoom: 19 }).addTo(_comparisonMap);

  // GeoJSON 바운더리 레이어
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

  // 날짜별 경로 그리기
  var allPoints = [];
  var legendHtml = '';

  for (var idx = 0; idx < dayOrder.length; idx++) {
    var day = dayOrder[idx];
    var points = dayGroups[day];
    var color = _ROUTE_COLORS[idx % _ROUTE_COLORS.length];
    var label = day.substring(5); // MM-DD

    // 폴리라인 (해당 날짜 포인트끼리만 연결)
    if (points.length > 1) {
      L.polyline(points, { color: color, weight: 3, opacity: 0.85 }).addTo(_comparisonMap);
    }

    // 마커
    for (var k = 0; k < points.length; k++) {
      L.circleMarker(points[k], {
        radius: 4, fillColor: color, color: 'rgba(0,0,0,0.3)',
        weight: 1.5, fillOpacity: 0.9
      }).addTo(_comparisonMap);
    }

    allPoints = allPoints.concat(points);
    legendHtml += '<span class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' + label + ' (' + points.length + '개)</span>';
  }

  // 레전드 업데이트
  var legendEl = popup.querySelector('.comparison-legend');
  if (legendEl) {
    legendEl.innerHTML = legendHtml;
  }

  // 맵 범위
  setTimeout(function() {
    if (!_comparisonMap) return;
    _comparisonMap.invalidateSize();
    if (allPoints.length > 0) {
      _comparisonMap.fitBounds(allPoints, { padding: [30, 30] });
    } else {
      _comparisonMap.setView([37.5665, 126.978], 11);
    }
  }, 200);

  // 통계
  renderComparisonStats(targetRoutes, targetDisplayName, dayOrder.length);
}

/* ─── 통계 렌더링 ─── */
function renderComparisonStats(targetRoutes, targetName, dayCount) {
  var statsEl = document.getElementById('comparison-stats');
  if (!statsEl) return;

  var targetCount = targetRoutes.length;

  // 날짜별로 거리 계산 (날짜 넘는 구간은 제외)
  var dated = _groupByDate(targetRoutes);
  var totalDist = 0;
  for (var day in dated.groups) {
    var pts = dated.groups[day];
    for (var j = 1; j < pts.length; j++) {
      totalDist += haversine(
        { lat: pts[j - 1][0], lng: pts[j - 1][1] },
        { lat: pts[j][0], lng: pts[j][1] }
      );
    }
  }

  var targetScore = targetCount * 10;

  statsEl.innerHTML =
    '<div class="comparison-stat-row">' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">수거량</div>' +
        '<div class="comparison-stat-card-value">' + targetCount + '<span class="comparison-stat-unit">개</span></div>' +
      '</div>' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">이동거리</div>' +
        '<div class="comparison-stat-card-value">' + totalDist.toFixed(2) + '<span class="comparison-stat-unit">km</span></div>' +
      '</div>' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">활동일</div>' +
        '<div class="comparison-stat-card-value">' + (dayCount || 0) + '<span class="comparison-stat-unit">일</span></div>' +
      '</div>' +
    '</div>';
}

/* ─── 맵 닫기 ─── */
function closeComparisonMap() {
  var popup = document.getElementById('comparison-popup');
  if (popup) popup.classList.remove('active');

  if (_comparisonMap) {
    _comparisonMap.remove();
    _comparisonMap = null;
  }
}
