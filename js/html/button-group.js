'use strict';

/* 플로깅뷰 하단 (3열: 로그아웃 / 촬영 / 대쉬보드) */
var _HTML_BUTTON_GROUP = '' +
  '<div class="btn-group">' +
    '<button class="btn-group-item btn-logout" onclick="logout()">' +
      '<span class="btn-label">로그아웃</span>' +
    '</button>' +
    '<button class="btn-capture" onclick="capturePhoto()"></button>' +
    '<button class="btn-group-item btn-dashboard" onclick="goToDashboard()">' +
      '<span class="btn-label">대쉬보드</span>' +
    '</button>' +
  '</div>';

/* 대쉬보드뷰 하단 (3열: 홈 / 캘린더 / AI 분석) */
var _HTML_BUTTON_GROUP_DASHBOARD = '' +
  '<div class="btn-group">' +
    '<button class="btn-group-item" onclick="goToHome()">' +
      '<span class="btn-label">홈</span>' +
    '</button>' +
    '<button class="btn-group-item" onclick="openCalendar()">' +
      '<span class="btn-label">캘린더</span>' +
    '</button>' +
    '<button class="btn-group-item" onclick="openAIAnalysis()">' +
      '<span class="btn-label">AI 분석</span>' +
    '</button>' +
  '</div>';
