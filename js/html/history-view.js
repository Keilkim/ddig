'use strict';

var _HTML_HISTORY_VIEW = '' +
  '<div class="history-section">' +
    '<h3 class="history-title">히스토리</h3>' +
    _HTML_FILTER_BAR +
    '<div class="history-charts">' +
      '<div class="chart-box">' +
        '<h4 class="chart-label">쓰레기 유형 분포</h4>' +
        '<canvas id="chart-history-type"></canvas>' +
      '</div>' +
      '<div class="chart-box">' +
        '<h4 class="chart-label">수거 추이</h4>' +
        '<canvas id="chart-history-trend"></canvas>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="collection-section">' +
    '<h3 class="history-title">내 수집 목록</h3>' +
    '<div id="collection-grid" class="collection-grid"></div>' +
  '</div>';
