'use strict';

var _HTML_DASHBOARD_DISPLAY = '' +
  '<div class="dashboard-display">' +
    '<div class="dashboard-date-label">' +
      '<span id="dashboard-date-text">오늘</span>' +
    '</div>' +
    '<div class="plogging-day-row">' +
      '<div class="route-map-col">' +
        '<div id="route-map" class="route-map"></div>' +
        '<div class="distance-display">' +
          '<span class="distance-label">이동 거리</span>' +
          '<span id="distance-value" class="distance-value">0.0 km</span>' +
        '</div>' +
      '</div>' +
      '<div class="chart-col" id="day-chart-area">' +
        '<div class="stat-card">' +
          '<span class="stat-label">주운 쓰레기</span>' +
          '<span id="trash-count" class="stat-value">0</span>' +
        '</div>' +
        '<div class="chart-box">' +
          '<canvas id="chart-trash-type"></canvas>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
