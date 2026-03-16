'use strict';

/* ════════════════════════════════════════
   인증 (Supabase Auth + Google OAuth)
   ════════════════════════════════════════ */

var supabaseClient = null;

/* ─── 초기화 ─── */
function initSupabase() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

/* ─── 세션 확인 ─── */
async function checkAuth() {
  if (!supabaseClient) {
    if (!initSupabase()) return null;
  }
  var result = await supabaseClient.auth.getSession();
  var session = result.data.session;
  if (!session) return null;

  AppState.user = session.user;
  return session;
}

/* ─── 구글 로그인 ─── */
async function loginWithGoogle() {
  if (!supabaseClient) {
    if (!initSupabase()) {
      alert('Supabase 설정을 확인해주세요.');
      return;
    }
  }

  var redirectUrl = window.location.origin + '/app.html';

  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl }
  });
}

/* ─── 로그아웃 ─── */
async function logout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  AppState.user = null;
  window.location.replace('login.html');
}

/* ─── 계정 전환 ─── */
async function switchAccount() {
  if (!supabaseClient) {
    if (!initSupabase()) return;
  }
  // 현재 세션 종료 후 새 로그인 (prompt: select_account)
  await supabaseClient.auth.signOut();
  AppState.user = null;

  var redirectUrl = window.location.origin + '/app.html';

  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: { prompt: 'select_account' }
    }
  });
}

/* ─── 자동 로그인 토글 ─── */
async function toggleAutoLogin(enabled) {
  localStorage.setItem('digg_auto_login', enabled ? 'true' : 'false');

  // 프로필에도 저장
  if (supabaseClient && AppState.user) {
    await supabaseClient
      .from('profiles')
      .update({ auto_login: enabled })
      .eq('id', AppState.user.id);
  }
}

/* ─── 자동 로그인 체크 (login.html 에서 호출) ─── */
async function checkAutoLogin() {
  var autoLogin = localStorage.getItem('digg_auto_login');
  if (autoLogin !== 'true') return;

  if (!supabaseClient) {
    if (!initSupabase()) return;
  }

  var result = await supabaseClient.auth.getSession();
  var session = result.data.session;
  if (session) {
    window.location.replace('app.html');
  }
}

/* ─── 세션 변경 감지 ─── */
function listenAuthChanges() {
  if (!supabaseClient) return;
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      AppState.user = null;
    } else if (event === 'TOKEN_REFRESHED' && session) {
      AppState.user = session.user;
    }
  });
}
