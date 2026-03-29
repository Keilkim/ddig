'use strict';

/* ════════════════════════════════════════
   Supabase DB CRUD 모듈
   ════════════════════════════════════════ */

/* ─── 사진 메타데이터 저장 ─── */
async function savePhotoMeta(data) {
  if (!supabaseClient || !AppState.user) return null;

  // 시군구 코드 결정
  var districtCode = null;
  if (data.latitude && data.longitude) {
    var district = findDistrict(data.latitude, data.longitude);
    if (district) districtCode = district.code;
  }

  var result = await supabaseClient
    .from('photos')
    .insert({
      user_id: AppState.user.id,
      storage_path: data.storagePath,
      captured_at: data.capturedAt || new Date().toISOString(),
      latitude: data.latitude,
      longitude: data.longitude,
      trash_category: data.trashCategory || null,
      pollution_impact: data.pollutionImpact || null,
      gemini_raw: data.geminiRaw || null,
      district_code: districtCode
    })
    .select()
    .single();

  if (result.error) {
    console.error('메타데이터 저장 실패:', result.error);
    return null;
  }
  return result.data;
}

/* ─── 사진 메타데이터 업데이트 (Gemini 분석 결과) ─── */
async function updatePhotoAnalysis(photoId, analysis) {
  if (!supabaseClient) return;

  await supabaseClient
    .from('photos')
    .update({
      trash_category: analysis.trash_category,
      pollution_impact: analysis.pollution_impact,
      gemini_raw: analysis
    })
    .eq('id', photoId);
}

/* ─── 사용자 사진 목록 (최신순) ─── */
async function loadUserPhotos() {
  if (!supabaseClient || !AppState.user) return [];

  var result = await supabaseClient
    .from('photos')
    .select('*')
    .eq('user_id', AppState.user.id)
    .order('captured_at', { ascending: false });

  if (result.error) {
    console.error('사진 로드 실패:', result.error);
    return [];
  }
  return result.data || [];
}

/* ─── 사진 삭제 (DB + Storage) ─── */
async function deletePhoto(photoId) {
  if (!supabaseClient) return;

  // 먼저 storage_path 가져오기
  var result = await supabaseClient
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .single();

  if (result.data) {
    await deletePhotoFile(result.data.storage_path);
  }

  await supabaseClient
    .from('photos')
    .delete()
    .eq('id', photoId);
}

/* ─── 날짜별 사진 데이터 ─── */
async function loadPhotosByDate(date) {
  if (!supabaseClient || !AppState.user) return [];

  var startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  var endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  var result = await supabaseClient
    .from('photos')
    .select('*')
    .eq('user_id', AppState.user.id)
    .gte('captured_at', startOfDay.toISOString())
    .lte('captured_at', endOfDay.toISOString())
    .order('captured_at', { ascending: true });

  return result.data || [];
}

/* ─── 기간별 사진 데이터 ─── */
async function loadPhotosByPeriod(periodKey) {
  if (!supabaseClient || !AppState.user) return [];

  var now = new Date();
  var from = new Date();

  switch (periodKey) {
    case '1d': from.setDate(now.getDate() - 1); break;
    case '1w': from.setDate(now.getDate() - 7); break;
    case '1m': from.setMonth(now.getMonth() - 1); break;
    case '3m': from.setMonth(now.getMonth() - 3); break;
    case '6m': from.setMonth(now.getMonth() - 6); break;
    default: from.setMonth(now.getMonth() - 1);
  }

  var result = await supabaseClient
    .from('photos')
    .select('*')
    .eq('user_id', AppState.user.id)
    .gte('captured_at', from.toISOString())
    .order('captured_at', { ascending: true });

  return result.data || [];
}

/* ─── 랭킹 데이터 조회 (RPC) ─── */
async function loadRankingData(scope) {
  if (!supabaseClient) return [];

  var result = await supabaseClient.rpc('get_ranking', { rank_scope: scope || 'national' });
  if (result.error) {
    console.error('랭킹 로드 실패:', result.error);
    return [];
  }
  return result.data || [];
}

/* ─── 특정 유저 경로 조회 (RPC) ─── */
async function loadUserRoutes(userId) {
  if (!supabaseClient) return [];

  var result = await supabaseClient.rpc('get_user_routes', { target_user_id: userId });
  if (result.error) {
    console.error('경로 로드 실패:', result.error);
    return [];
  }
  return result.data || [];
}

/* ─── 특정 유저 시군구별 통계 (RPC) ─── */
async function loadUserDistrictStats(userId) {
  if (!supabaseClient) return [];

  var result = await supabaseClient.rpc('get_user_district_stats', { target_user_id: userId });
  if (result.error) {
    console.error('시군구 통계 로드 실패:', result.error);
    return [];
  }
  return result.data || [];
}

/* ─── 기존 사진 district_code 백필 (1회) ─── */
async function backfillDistrictCodes() {
  if (!supabaseClient || !AppState.user) return;
  if (!_districtGeoJSON) return;

  var result = await supabaseClient
    .from('photos')
    .select('id, latitude, longitude')
    .eq('user_id', AppState.user.id)
    .is('district_code', null)
    .not('latitude', 'is', null);

  if (!result.data || result.data.length === 0) return;

  for (var i = 0; i < result.data.length; i++) {
    var photo = result.data[i];
    var district = findDistrict(photo.latitude, photo.longitude);
    if (district) {
      await supabaseClient
        .from('photos')
        .update({ district_code: district.code })
        .eq('id', photo.id);
    }
  }
}

/* ─── 월별 활동 요약 (캘린더용) ─── */
async function loadMonthlyActivity(year, month) {
  if (!supabaseClient || !AppState.user) return {};

  var from = new Date(year, month, 1);
  var to = new Date(year, month + 1, 0, 23, 59, 59);

  var result = await supabaseClient
    .from('photos')
    .select('captured_at, latitude, longitude')
    .eq('user_id', AppState.user.id)
    .gte('captured_at', from.toISOString())
    .lte('captured_at', to.toISOString());

  if (!result.data) return {};

  // 날짜별 그룹핑
  var activity = {};
  for (var i = 0; i < result.data.length; i++) {
    var dayKey = result.data[i].captured_at.substring(0, 10);
    if (!activity[dayKey]) activity[dayKey] = { count: 0 };
    activity[dayKey].count++;
  }
  return activity;
}
