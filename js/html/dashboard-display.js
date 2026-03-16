'use strict';

var _HTML_DASHBOARD_DISPLAY = '' +
  '<div class="dashboard-display">' +
    '<div class="dashboard-date-label">' +
      '<span id="dashboard-date-text">오늘</span>' +
    '</div>' +
    '<!-- 플로깅한 날 뷰: 2열 (지도 + 차트) -->' +
    '<div class="plogging-day-row">' +
      '<!-- 1열: 루트맵 + 이동거리 -->' +
      '<div class="route-map-col">' +
        '<div id="route-map" class="route-map"></div>' +
        '<div class="distance-display">' +
          '<span class="distance-label">이동 거리</span>' +
          '<span id="distance-value" class="distance-value">0.0 km</span>' +
        '</div>' +
      '</div>' +
      '<!-- 2열: 차트 -->' +
      '<div class="chart-col" id="day-chart-area">' +
        '<div class="stat-card">' +
          '<span class="stat-label">주운 쓰레기</span>' +
          '<span id="trash-count" class="stat-value">0</span>' +
        '</div>' +
        '<div class="chart-box">' +
          '<canvas id="chart-trash-type"></canvas>' +
        '</div>' +
        '<div class="stat-card">' +
          '<span class="stat-label">오염도 저감</span>' +
          '<span id="pollution-level" class="stat-value pollution-badge">-</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
