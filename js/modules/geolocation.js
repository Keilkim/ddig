'use strict';

/* ════════════════════════════════════════
   위치 정보 모듈
   ════════════════════════════════════════ */

function getCurrentLocation() {
  return new Promise(function(resolve) {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      function() {
        resolve({ latitude: null, longitude: null });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}
