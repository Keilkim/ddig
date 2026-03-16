'use strict';

/* ════════════════════════════════════════
   앱 초기화 (app.html 진입점)
   ════════════════════════════════════════ */

(async function() {
  // 1. Supabase 초기화
  if (!initSupabase()) {
    console.error('Supabase 초기화 실패');
    window.location.replace('login.html');
    return;
  }

  // 2. 인증 확인
  var session = await checkAuth();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  // 3. 세션 변경 감지
  listenAuthChanges();

  // 4. 권한 확인
  var permGranted = localStorage.getItem('digg_permission');
  if (permGranted === 'granted') {
    AppState.permissionGranted = true;
    showView('plogging');
    initCamera();
    refreshGallery();
  } else {
    showPopup('permission-popup');
  }
})();
