'use strict';

/* ════════════════════════════════════════
   전역 상태 관리
   ════════════════════════════════════════ */

var AppState = {
  user: null,
  permissionGranted: false,
  currentView: 'plogging',
  selectedDate: null,
  filterPeriod: '1m',
  cameraStream: null,
  cameraActive: false,
  photos: [],
  dashboardData: null
};
