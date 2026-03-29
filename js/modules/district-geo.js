'use strict';

/* ════════════════════════════════════════
   시/군/구 GeoJSON & 역지오코딩 모듈
   ════════════════════════════════════════ */

var _districtGeoJSON = null;
var _districtLoading = null;

/* ─── GeoJSON 로드 (lazy, 캐시) ─── */
function loadDistrictGeoJSON() {
  if (_districtGeoJSON) return Promise.resolve(_districtGeoJSON);
  if (_districtLoading) return _districtLoading;

  _districtLoading = fetch('data/sigungu.geojson')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      _districtGeoJSON = data;
      AppState.districtGeoJSON = data;
      return data;
    })
    .catch(function(err) {
      console.error('GeoJSON 로드 실패:', err);
      _districtLoading = null;
      return null;
    });

  return _districtLoading;
}

/* ─── Ray-casting point-in-polygon ─── */
function _pointInPolygon(lat, lng, ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][1], yi = ring[i][0];
    var xj = ring[j][1], yj = ring[j][0];
    var intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _pointInGeometry(lat, lng, geometry) {
  if (geometry.type === 'Polygon') {
    if (!_pointInPolygon(lat, lng, geometry.coordinates[0])) return false;
    for (var h = 1; h < geometry.coordinates.length; h++) {
      if (_pointInPolygon(lat, lng, geometry.coordinates[h])) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (var i = 0; i < geometry.coordinates.length; i++) {
      var poly = geometry.coordinates[i];
      if (_pointInPolygon(lat, lng, poly[0])) {
        var inHole = false;
        for (var k = 1; k < poly.length; k++) {
          if (_pointInPolygon(lat, lng, poly[k])) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

/* ─── 좌표 → 시군구 코드/이름 반환 ─── */
function findDistrict(lat, lng) {
  if (!_districtGeoJSON) return null;

  for (var i = 0; i < _districtGeoJSON.features.length; i++) {
    var feat = _districtGeoJSON.features[i];
    if (_pointInGeometry(lat, lng, feat.geometry)) {
      return {
        code: feat.properties.SIG_CD,
        name: feat.properties.SIG_KOR_NM,
        sido: feat.properties.SIDO_NM
      };
    }
  }
  return null;
}

/* ─── 시군구 코드로 GeoJSON feature 반환 ─── */
function getDistrictFeature(code) {
  if (!_districtGeoJSON) return null;

  for (var i = 0; i < _districtGeoJSON.features.length; i++) {
    if (_districtGeoJSON.features[i].properties.SIG_CD === code) {
      return _districtGeoJSON.features[i];
    }
  }
  return null;
}

/* ─── 시군구 코드 → 한글 이름 ─── */
function getDistrictName(code) {
  var feat = getDistrictFeature(code);
  if (!feat) return code || '';
  return feat.properties.SIDO_NM + ' ' + feat.properties.SIG_KOR_NM;
}

/* ─── 시군구 코드 → 짧은 이름 (구/군/시만) ─── */
function getDistrictShortName(code) {
  var feat = getDistrictFeature(code);
  if (!feat) return code || '';
  return feat.properties.SIG_KOR_NM;
}
