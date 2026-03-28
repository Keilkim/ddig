'use strict';

/* ════════════════════════════════════════
   HTML 조립 (Hierhear 패턴)
   한 화면에 모든 것이 들어오도록 설계
   ════════════════════════════════════════ */
(function() {
  var html =
    /* 플로깅 뷰 — 100vh 고정 */
    '<div id="view-plogging" class="view-container active">' +
      _HTML_TITLE_BAR +
      _HTML_CAMERA_VIEW +
      _HTML_GALLERY +
      _HTML_BUTTON_GROUP +
    '</div>' +

    /* 대쉬보드 뷰 */
    '<div id="view-dashboard" class="view-container">' +
      _HTML_TITLE_BAR +
      _HTML_DASHBOARD_TABS +
      _HTML_DASHBOARD_DISPLAY +
      _HTML_HISTORY_VIEW +
      _HTML_RANKING_VIEW +
      _HTML_BUTTON_GROUP_DASHBOARD +
    '</div>' +

    /* 팝업들 */
    _HTML_PERMISSION_POPUP +
    _HTML_CALENDAR_POPUP +
    _HTML_AI_POPUP;

  document.body.insertAdjacentHTML('afterbegin', html);
})();
