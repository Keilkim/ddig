'use strict';

/* ════════════════════════════════════════
   상대방 경로 뷰 모듈
   ════════════════════════════════════════ */

var _comparisonMap = null;

/* ─── 다크 맵 타일 URL ─── */
var _DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/* ─── 상대방 경로 맵 열기 ─── */
async function openComparisonMap(targetUserId, targetDisplayName) {
  var popup = document.getElementById('comparison-popup');
  if (!popup) return;
  popup.classList.add('active');

  // 제목 업데이트
  var title = document.getElementById('comparison-title');
  if (title) title.textContent = targetDisplayName + '님의 활동';

  // 유저 바 업데이트
  var userBar = document.getElementById('comparison-user-bar');
  if (userBar) {
    userBar.innerHTML =
      '<div class="comparison-user"><span class="comparison-user-dot" style="background:#34C759"></span>' + targetDisplayName + '의 경로</div>';
  }

  // 맵 초기화
  var mapEl = document.getElementById('comparison-map');
  if (!mapEl) return;
  mapEl.innerHTML = '<div class="ranking-empty"><div class="ranking-spinner"></div><div style="margin-top:12px;font-size:12px;color:var(--color-tertiary)">경로 불러오는 중...</div></div>';

  // 데이터 병렬 로드
  var isSelf = AppState.user && targetUserId === AppState.user.id;
  var results = await Promise.all([
    isSelf ? loadUserPhotos() : loadUserRoutes(targetUserId),
    isSelf ? loadUserDistrictStats(AppState.user.id) : loadUserDistrictStats(targetUserId)
  ]);

  var targetRoutes = results[0];
  var targetDistrictStats = results[1];

  // 맵 렌더링
  mapEl.innerHTML = '';
  if (_comparisonMap) {
    _comparisonMap.remove();
    _comparisonMap = null;
  }

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
          return {
            color: '#34C759',
            weight: 2,
            fillColor: '#34C759',
            fillOpacity: opacity
          };
        }
        return {
          color: 'rgba(255,255,255,0.08)',
          weight: 0.5,
          fillColor: 'transparent',
          fillOpacity: 0
        };
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

  // 상대방 경로
  var targetPoints = [];
  for (var t = 0; t < targetRoutes.length; t++) {
    if (targetRoutes[t].latitude && targetRoutes[t].longitude) {
      targetPoints.push([targetRoutes[t].latitude, targetRoutes[t].longitude]);
    }
  }

  if (targetPoints.length > 1) {
    L.polyline(targetPoints, { color: '#34C759', weight: 3, opacity: 0.85 }).addTo(_comparisonMap);
  }
  for (var k = 0; k < targetPoints.length; k++) {
    L.circleMarker(targetPoints[k], {
      radius: 4, fillColor: '#34C759', color: 'rgba(0,0,0,0.3)',
      weight: 1.5, fillOpacity: 0.9
    }).addTo(_comparisonMap);
  }

  // 맵 크기 재계산 후 범위 맞춤 (팝업 렌더링 완료 대기)
  setTimeout(function() {
    if (!_comparisonMap) return;
    _comparisonMap.invalidateSize();

    if (targetPoints.length > 0) {
      _comparisonMap.fitBounds(targetPoints, { padding: [30, 30] });
    } else {
      _comparisonMap.setView([37.5665, 126.978], 11);
    }
  }, 200);

  // 통계 렌더링
  renderComparisonStats(targetRoutes, targetDisplayName);
}

/* ─── 통계 렌더링 (상대방만) ─── */
function renderComparisonStats(targetRoutes, targetName) {
  var statsEl = document.getElementById('comparison-stats');
  if (!statsEl) return;

  var targetCount = targetRoutes.length;

  var targetDist = 0;
  var tPoints = [];
  for (var i = 0; i < targetRoutes.length; i++) {
    if (targetRoutes[i].latitude && targetRoutes[i].longitude) {
      tPoints.push({ lat: targetRoutes[i].latitude, lng: targetRoutes[i].longitude });
    }
  }
  for (var j = 1; j < tPoints.length; j++) {
    targetDist += haversine(tPoints[j - 1], tPoints[j]);
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
        '<div class="comparison-stat-card-value">' + targetDist.toFixed(2) + '<span class="comparison-stat-unit">km</span></div>' +
      '</div>' +
      '<div class="comparison-stat-card">' +
        '<div class="comparison-stat-card-label">점수</div>' +
        '<div class="comparison-stat-card-value">' + targetScore.toLocaleString() + '<span class="comparison-stat-unit">pt</span></div>' +
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
