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
  var isSelf = AppState.user && targetUserId === AppState.user.id;
  var results = await Promise.all([
    isSelf ? loadUserPhotos() : loadUserRoutes(targetUserId),
    isSelf ? loadUserDistrictStats(AppState.user.id) : loadUserDistrictStats(targetUserId)
  ]);

  var targetRoutes = results[0];
  var targetDistrictStats = results[1];

  // 포인트 추출
  var points = [];
  for (var i = 0; i < targetRoutes.length; i++) {
    var r = targetRoutes[i];
    if (r.latitude && r.longitude) {
      points.push([r.latitude, r.longitude]);
    }
  }

  if (points.length === 0) {
    mapEl.innerHTML =
      '<div class="ranking-empty">' +
        '<div style="font-size:40px;margin-bottom:12px">📍</div>' +
        '<div>' + targetDisplayName + '님의 경로 데이터가 없습니다</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">GPS 정보가 있는 플로깅 기록이 필요합니다</div>' +
      '</div>';
    renderComparisonStats(0, 0);
    return;
  }

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

  // 전체 경로 한번에 그리기
  if (points.length > 1) {
    L.polyline(points, { color: '#34C759', weight: 3, opacity: 0.85 }).addTo(_comparisonMap);
  }
  for (var k = 0; k < points.length; k++) {
    L.circleMarker(points[k], {
      radius: 4, fillColor: '#34C759', color: 'rgba(0,0,0,0.3)',
      weight: 1.5, fillOpacity: 0.9
    }).addTo(_comparisonMap);
  }

  // 레전드
  var legendEl = popup.querySelector('.comparison-legend');
  if (legendEl) {
    legendEl.innerHTML =
      '<span class="legend-item"><span class="legend-dot" style="background:#34C759"></span>경로 (' + points.length + '곳)</span>' +
      '<span class="legend-item"><span class="legend-dot legend-dot-area" style="background:rgba(52,199,89,0.35)"></span>활동 지역</span>';
  }

  // fitBounds
  setTimeout(function() {
    if (!_comparisonMap) return;
    _comparisonMap.invalidateSize();
    _comparisonMap.fitBounds(points, { padding: [30, 30] });
  }, 200);

  // 거리 계산
  var totalDist = 0;
  for (var j = 1; j < points.length; j++) {
    totalDist += haversine(
      { lat: points[j - 1][0], lng: points[j - 1][1] },
      { lat: points[j][0], lng: points[j][1] }
    );
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

  if (_comparisonMap) { _comparisonMap.remove(); _comparisonMap = null; }
}
