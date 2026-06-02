-- ============================================================
-- RLS 컬럼 노출 수정 마이그레이션
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 1회 실행하세요.
-- (이미 운영 중인 DB에 안전하게 적용되도록 작성됨 — 재실행해도 무방)
-- ============================================================
--
-- 문제: 기존 "photos_select_location_all" 정책(auth.uid() IS NOT NULL)은
--       RLS가 row-level이라 컬럼을 가리지 못해, 로그인한 누구나 타인의
--       storage_path / gemini_raw / 정확한 GPS 전체 행을 SELECT할 수 있었다.
--
-- 해결: photos 테이블은 "본인 데이터만" SELECT 가능하도록 되돌리고,
--       타 유저의 비민감 정보(위치/카테고리/오염도/시군구)는
--       민감 컬럼을 제외한 photos_public 뷰로만 노출한다.
-- ============================================================

-- 1) 과도하게 넓은 정책 제거
DROP POLICY IF EXISTS "photos_select_location_all" ON public.photos;

-- 2) 본인 데이터만 직접 조회 가능하도록 복구
DROP POLICY IF EXISTS "photos_select_own" ON public.photos;
CREATE POLICY "photos_select_own" ON public.photos
  FOR SELECT USING (auth.uid() = user_id);

-- 3) 비민감 컬럼만 노출하는 공개 뷰 (랭킹/경로 비교용)
--    ⚠️ security_invoker=false(기본값)로 유지해야 함. 소유자 권한으로
--    실행되어 photos의 RLS를 우회한다 → 모든 유저 행이 보이되, SELECT
--    목록에 없는 storage_path / gemini_raw 는 애초에 노출되지 않는다.
--    (위치/경로는 "다른 유저 경로 비교" 기능의 핵심이라 의도적으로 포함.
--     security_invoker=true 로 바꾸면 본인 행만 보여 랭킹/비교가 깨진다.)
DROP VIEW IF EXISTS public.photos_public;
CREATE VIEW public.photos_public AS
  SELECT
    id,
    user_id,
    latitude,
    longitude,
    trash_category,
    pollution_impact,
    district_code,
    captured_at
  FROM public.photos;

-- 4) 인증된 유저만 공개 뷰 조회 가능
REVOKE ALL ON public.photos_public FROM anon;
GRANT SELECT ON public.photos_public TO authenticated;

-- 5) PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 적용 후 검증(선택):
--   -- A 유저 토큰으로 아래가 0행/권한오류여야 정상 (타인 행 차단)
--   SELECT storage_path FROM public.photos WHERE user_id <> auth.uid() LIMIT 1;
--   -- 공개 뷰는 타인 위치가 보이되 storage_path 컬럼 자체가 없어야 정상
--   SELECT * FROM public.photos_public LIMIT 1;
-- ============================================================
