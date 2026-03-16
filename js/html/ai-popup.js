'use strict';

var _HTML_AI_POPUP = '' +
  '<div id="ai-popup" class="popup-overlay">' +
    '<div class="popup-content ai-popup-box">' +
      '<h2 class="ai-popup-title">AI 분석</h2>' +
      '<div id="ai-loading" class="ai-loading">' +
        '<div class="spinner"></div>' +
        '<p>데이터를 분석하고 있습니다...</p>' +
      '</div>' +
      '<div id="ai-result" class="ai-result hidden">' +
        '<!-- AI 분석 결과 동적 삽입 -->' +
      '</div>' +
      '<button class="ai-close-btn" onclick="closeAIPopup()">닫기</button>' +
    '</div>' +
  '</div>';
