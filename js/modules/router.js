'use strict';

/* ════════════════════════════════════════
   SPA 뷰 라우터
   ════════════════════════════════════════ */

/* ─── 뷰 전환 ─── */
function showView(viewName) {
  var containers = document.querySelectorAll('.view-container');
  for (var i = 0; i < containers.length; i++) {
    containers[i].classList.remove('active');
  }
  var target = document.getElementById('view-' + viewName);
  if (target) {
    target.classList.add('active');
    AppState.currentView = viewName;
  }
}

/* ─── 팝업 열기 ─── */
function showPopup(popupId) {
  var popup = document.getElementById(popupId);
  if (popup) popup.classList.add('active');
}

/* ─── 팝업 닫기 ─── */
function closePopup(popupId) {
  var popup = document.getElementById(popupId);
  if (popup) popup.classList.remove('active');
}

/* ─── 권한 승인 ─── */
async function approvePermission() {
  try {
    // 카메라 권한 (확인 후 즉시 해제)
    var permStream = await navigator.mediaDevices.getUserMedia({ video: true });
    permStream.getTracks().forEach(function(t) { t.stop(); });
    // 위치 권한
    navigator.geolocation.getCurrentPosition(
      function() {},
      function() {},
      { timeout: 5000 }
    );

    AppState.permissionGranted = true;
    localStorage.setItem('digg_permission', 'granted');
    closePopup('permission-popup');
    showView('plogging');
  } catch (err) {
    alert('카메라 또는 위치 권한이 필요합니다.\n설정에서 권한을 허용해주세요.');
  }
}

/* ─── 권한 거절 ─── */
function rejectPermission() {
  closePopup('permission-popup');
  window.location.replace('login.html');
}

/* ─── 네비게이션 함수 ─── */
function goToDashboard() {
  showView('dashboard');
  loadDashboard();
}

function goToHome() {
  showView('plogging');
  if (AppState.cameraActive) {
    ensureCameraPlaying();
  }
}

function openCalendar() {
  showPopup('calendar-popup');
  renderCalendar();
}

function closeCalendar() {
  closePopup('calendar-popup');
}

function openAIAnalysis() {
  showPopup('ai-popup');
  runAIAnalysis();
}

function closeAIPopup() {
  closePopup('ai-popup');
}
