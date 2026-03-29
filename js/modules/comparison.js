'use strict';

/* ════════════════════════════════════════
   경로 비교 맵 모듈
   ════════════════════════════════════════ */

var _comparisonMap = null;

/* ─── 비교 맵 열기 ─── */
async function openComparisonMap(targetUserId, targetDisplayName) {
  var popup = document.getElementById('comparison-popup');
  if (!popup) return;
  popup.classList.add('active');

  // 제목 업데이트
  var title = document.getElementById('comparison-title');
  if (title) title.textContent = targetDisplayName + '님과 비교';

  // 유저 바 업데이트
  var userBar = document.getElementById('comparison-user-bar');
  if (userBar) {
    var myName = (AppState.user && AppState.user.user_metadata)
      ? (AppState.user.user_metadata.full_name || AppState.user.user_metadata.name || '나')
      : '나';
    userBar.innerHTML =
      '<div class="comparison-user"><span class="comparison-user-dot" style="background:#34C759"></span>' + myName + '</div>' +
      '<div class="comparison-vs">VS</div>' +
      '<div class="comparison-user"><span class="comparison-user-dot" style="background:#007AFF"></span>' + targetDisplayName + '</div>';
  }

  // 맵 초기화
  var mapEl = document.getElementById('comparison-map');
  if (!mapEl) return;
  mapEl.innerHTML = '<div class="ranking-empty"><div class="ranking-spinner"></div><div style="margin-top:12px;font-size:12px;color:var(--color-tertiary)">경로 불러오는 중...</div></div>';

  // 데이터 병렬 로드
  var isSelf = AppState.user && targetUserId === AppState.user.id;
  var results = await Promise.all([
    loadUserPhotos(),
    isSelf ? loadUserPhotos() : loadUserRoutes(targetUserId),
    isSelf ? loadUserDistrictStats(AppState.user.id) : loadUserDistrictStats(targetUserId)
  ]);

  var myPhotos = results[0];
  var targetRoutes = results[1];
  var targetDistrictStats = results[2];

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
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_comparisonMap);

  // GeoJSON 바운더리 레이어
  var geojson = _districtGeoJSON || AppState.districtGeoJSON;
  if (geojson) {
    // 상대방 다빈도 시군구 맵 생성
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
          var opacity = 0.15 + (visits / maxVisits) * 0.45;
          return {
            color: '#007AFF',
            weight: 2,
            fillColor: '#007AFF',
            fillOpacity: opacity
          };
        }
        return {
          color: '#ccc',
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

  // 내 경로 (초록색)
  var myPoints = [];
  for (var i = 0; i < myPhotos.length; i++) {
    if (myPhotos[i].latitude && myPhotos[i].longitude) {
      myPoints.push([myPhotos[i].latitude, myPhotos[i].longitude]);
    }
  }

  if (myPoints.length > 1) {
    L.polyline(myPoints, { color: '#34C759', weight: 3, opacity: 0.8 }).addTo(_comparisonMap);
  }
  for (var j = 0; j < myPoints.length; j++) {
    L.circleMarker(myPoints[j], {
      radius: 4, fillColor: '#34C759', color: '#fff',
      weight: 1.5, fillOpacity: 0.9
    }).addTo(_comparisonMap);
  }

  // 상대방 경로 (파란색)
  var targetPoints = [];
  for (var t = 0; t < targetRoutes.length; t++) {
    if (targetRoutes[t].latitude && targetRoutes[t].longitude) {
      targetPoints.push([targetRoutes[t].latitude, targetRoutes[t].longitude]);
    }
  }

  if (targetPoints.length > 1) {
    L.polyline(targetPoints, { color: '#007AFF', weight: 3, opacity: 0.8 }).addTo(_comparisonMap);
  }
  for (var k = 0; k < targetPoints.length; k++) {
    L.circleMarker(targetPoints[k], {
      radius: 4, fillColor: '#007AFF', color: '#fff',
      weight: 1.5, fillOpacity: 0.9
    }).addTo(_comparisonMap);
  }

  // 맵 범위 조정
  var allPoints = myPoints.concat(targetPoints);
  if (allPoints.length > 0) {
    _comparisonMap.fitBounds(allPoints, { padding: [30, 30] });
  } else {
    _comparisonMap.setView([37.5665, 126.978], 11);
  }

  // 비교 통계 렌더링
  renderComparisonStats(myPhotos, targetRoutes, targetDisplayName);
}

/* ─── 비교 통계 렌더링 ─── */
function renderComparisonStats(myPhotos, targetRoutes, targetName) {
  var statsEl = document.getElementById('comparison-stats');
  if (!statsEl) return;

  var myCount = myPhotos.length;
  var targetCount = targetRoutes.length;

  var myDist = calcDistance(myPhotos);
  // targetRoutes는 photo 형식이 아니므로 직접 계산
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

  var myScore = myCount * 10;
  var targetScore = targetCount * 10;

  // 간단한 impact 합산 (내 것만 가능)
  var myImpact = 0;
  for (var m = 0; m < myPhotos.length; m++) {
    myImpact += Number(myPhotos[m].pollution_impact) || 0;
  }
  myScore += Math.round(myImpact * 5 + myDist * 2);

  statsEl.innerHTML =
    '<div class="comparison-stat-grid">' +
      '<div class="comparison-stat-header"></div>' +
      '<div class="comparison-stat-header comparison-stat-me">나</div>' +
      '<div class="comparison-stat-header comparison-stat-other">' + targetName + '</div>' +

      '<div class="comparison-stat-label">수거량</div>' +
      '<div class="comparison-stat-value comparison-stat-me">' + myCount + '개</div>' +
      '<div class="comparison-stat-value comparison-stat-other">' + targetCount + '개</div>' +

      '<div class="comparison-stat-label">이동거리</div>' +
      '<div class="comparison-stat-value comparison-stat-me">' + myDist.toFixed(2) + 'km</div>' +
      '<div class="comparison-stat-value comparison-stat-other">' + targetDist.toFixed(2) + 'km</div>' +

      '<div class="comparison-stat-label">점수</div>' +
      '<div class="comparison-stat-value comparison-stat-me">' + myScore.toLocaleString() + '</div>' +
      '<div class="comparison-stat-value comparison-stat-other">' + targetScore.toLocaleString() + '</div>' +
    '</div>';
}

/* ─── 비교 맵 닫기 ─── */
function closeComparisonMap() {
  var popup = document.getElementById('comparison-popup');
  if (popup) popup.classList.remove('active');

  if (_comparisonMap) {
    _comparisonMap.remove();
    _comparisonMap = null;
  }
}
