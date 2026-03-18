'use strict';

/* 플로깅뷰 하단 버튼 그룹 (3열) */
var _HTML_BUTTON_GROUP = '' +
  '<div class="btn-group">' +
    '<button class="btn-group-item btn-logout" onclick="logout()">' +
      '<span class="btn-label">로그아웃</span>' +
    '</button>' +
    '<button class="btn-capture" onclick="capturePhoto()">' +
      '<svg class="btn-capture-icon" viewBox="0 0 56 56" fill="none">' +
        '<circle cx="28" cy="28" r="26" stroke="#4ecdc4" stroke-width="2.5" fill="none"/>' +
        '<rect x="18" y="17" width="20" height="15" rx="3" fill="none" stroke="#fff" stroke-width="2"/>' +
        '<circle cx="28" cy="24.5" r="4" fill="none" stroke="#fff" stroke-width="1.8"/>' +
        '<rect x="23" y="14" width="10" height="4" rx="1.5" fill="none" stroke="#fff" stroke-width="1.5"/>' +
        '<circle cx="28" cy="38" r="2" fill="#4ecdc4"/>' +
      '</svg>' +
    '</button>' +
    '<button class="btn-group-item btn-dashboard" onclick="goToDashboard()">' +
      '<span class="btn-label">대쉬보드</span>' +
    '</button>' +
  '</div>';

/* 대쉬보드뷰 하단 버튼 그룹 (3열) */
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
