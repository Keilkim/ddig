'use strict';

var _HTML_COMPARISON_POPUP = '' +
  '<div id="comparison-popup" class="popup-overlay">' +
    '<div class="comparison-popup-box">' +
      '<div class="comparison-header">' +
        '<button class="comparison-back-btn" onclick="closeComparisonMap()">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
        '</button>' +
        '<h2 class="comparison-title" id="comparison-title">활동 경로</h2>' +
      '</div>' +
      '<div class="comparison-user-bar" id="comparison-user-bar"></div>' +
      '<div id="comparison-map" class="comparison-map"></div>' +
      '<div class="comparison-legend">' +
        '<span class="legend-item"><span class="legend-dot" style="background:#34C759"></span>경로</span>' +
        '<span class="legend-item"><span class="legend-dot legend-dot-area" style="background:rgba(52,199,89,0.35)"></span>활동 지역</span>' +
      '</div>' +
      '<div id="comparison-stats" class="comparison-stats"></div>' +
    '</div>' +
  '</div>';
