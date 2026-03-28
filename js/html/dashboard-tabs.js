'use strict';

var _HTML_DASHBOARD_TABS = '' +
  '<div class="dashboard-tabs">' +
    '<button class="dashboard-tab dashboard-tab-active" data-tab="activity" onclick="switchDashboardTab(\'activity\')">' +
      '활동' +
    '</button>' +
    '<button class="dashboard-tab" data-tab="ranking" onclick="switchDashboardTab(\'ranking\')">' +
      '랭킹' +
    '</button>' +
    /* Tab 3: 숨김 — 추후 확장용 */
    '<button class="dashboard-tab" data-tab="extra" onclick="switchDashboardTab(\'extra\')" style="display:none">' +
      '기타' +
    '</button>' +
  '</div>';
