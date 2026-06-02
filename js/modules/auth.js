'use strict';

/* ════════════════════════════════════════
   인증 (Supabase Auth + Google OAuth)
   ════════════════════════════════════════ */

var supabaseClient = null;

/* ─── 초기화 ─── */
function initSupabase() {
  // window.* 로 참조해야 config 파일 미로딩 시 ReferenceError 대신 false 반환
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return false;
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
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

/* ─── 간편 로그인 (구글 계정 없이 — 이름 + 소속 + 핸드폰 뒤 4자리) ───
   행사 운영용. 입력값으로 결정론적 합성 이메일/비번을 만들어 Supabase
   이메일 인증에 태운다. 같은 (이름·소속·4자리) = 같은 계정 = 재로그인/복구.
   ※ Supabase 대시보드에서 "Confirm email"을 꺼야 세션이 즉시 발급된다. */

// 결정론적 해시 (FNV-1a 변형, 한글 안전 — 8 hex)
function _diggHash(str, seed) {
  var h = seed >>> 0;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

// 이름·소속·4자리 → 합성 이메일/비번 (멱등)
function buildGuestCredentials(name, affiliation, phone4) {
  function norm(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ''); }
  var key = norm(name) + '' + norm(affiliation) + '' + norm(phone4);
  var hash = _diggHash(key, 0x811c9dc5) + _diggHash(key, 0x01000193); // 16 hex (~64bit)
  return {
    email: 'g' + hash + '@digg-guest.com',
    password: 'gp_' + hash
  };
}

async function signUpOrLoginSimple(name, affiliation, phone4) {
  if (!supabaseClient) {
    if (!initSupabase()) { alert('Supabase 설정을 확인해주세요.'); return; }
  }

  // 입력 검증
  name = (name || '').trim();
  affiliation = (affiliation || '').trim();
  phone4 = (phone4 || '').trim();
  if (!name) { alert('이름을 입력해주세요.'); return; }
  if (!affiliation) { alert('소속을 입력해주세요.'); return; }
  if (!/^\d{4}$/.test(phone4)) { alert('핸드폰 번호 뒤 4자리(숫자)를 입력해주세요.'); return; }

  var cred = buildGuestCredentials(name, affiliation, phone4);
  var meta = { display_name: name, affiliation: affiliation, phone_last4: phone4 };
  var session = null;

  // 1) 가입 시도
  var signUpRes = await supabaseClient.auth.signUp({
    email: cred.email,
    password: cred.password,
    options: { data: meta }
  });

  if (signUpRes.data && signUpRes.data.session) {
    session = signUpRes.data.session;
  } else {
    // 2) 이미 가입된 계정 → 같은 자격증명으로 로그인 (재로그인/복구)
    var signInRes = await supabaseClient.auth.signInWithPassword({
      email: cred.email,
      password: cred.password
    });
    if (signInRes.error) {
      console.error('간편 로그인 실패:', signInRes.error, signUpRes.error);
      var msg = String(signInRes.error.message || '');
      if (/confirm/i.test(msg)) {
        // 신규 가입인데 세션이 없는 경우 → Supabase "Confirm email"이 켜져 있음
        alert('가입 설정을 확인해주세요.\nSupabase에서 이메일 확인(Confirm email)을 꺼야 합니다.');
      } else {
        alert('로그인에 실패했어요.\n이름·소속·번호 뒤 4자리를 확인해주세요.');
      }
      return;
    }
    session = signInRes.data.session;
  }

  if (!session) {
    alert('세션 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
    return;
  }

  AppState.user = session.user;

  // 프로필 보강 (소속/이름 변경분 반영) — 행(row)은 가입 트리거가 이미 생성하므로
  // INSERT가 아닌 UPDATE로만 동기화한다(RLS update_own: auth.uid()=id).
  try {
    await supabaseClient
      .from('profiles')
      .update({ display_name: name, affiliation: affiliation, phone_last4: phone4 })
      .eq('id', session.user.id);
  } catch (e) { /* 프로필 보강 실패는 치명적이지 않음 */ }

  // 행사 중 재진입 편의를 위해 자동 로그인 ON
  localStorage.setItem('digg_auto_login', 'true');

  window.location.replace('app.html');
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
