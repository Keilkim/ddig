-- ============================================================
-- DIGG X GONGSIM Supabase 스키마
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- STEP 1: 테이블 생성
-- ============================================================

-- 사용자 프로필
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  affiliation  TEXT,           -- 소속(팀/단체) — 간편가입 & 랭킹 표시용
  phone_last4  TEXT,           -- 핸드폰 뒤 4자리 — 간편가입 구분/복구 키
  auto_login   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 사진 메타데이터 (플로깅 기록)
CREATE TABLE IF NOT EXISTS public.photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  trash_category   TEXT,
  pollution_impact NUMERIC,
  gemini_raw       JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_photos_user_date
  ON public.photos (user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_user_category
  ON public.photos (user_id, trash_category);

-- ============================================================
-- STEP 2: RLS 활성화
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: RLS 정책 — 사용자 본인 데이터만 접근
-- ============================================================

-- profiles
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- photos — 본인 데이터만
CREATE POLICY "photos_select_own" ON public.photos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "photos_insert_own" ON public.photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_update_own" ON public.photos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "photos_delete_own" ON public.photos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 4: 트리거 — 유저 가입 시 profiles 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 구글 OAuth & 간편가입(이름·소속·4자리) 모두 처리
  INSERT INTO public.profiles (id, display_name, avatar_url, affiliation, phone_last4)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name',
             NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url',
             NEW.raw_user_meta_data->>'picture', ''),
    NEW.raw_user_meta_data->>'affiliation',
    NEW.raw_user_meta_data->>'phone_last4'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 5: Storage 버킷 설정
-- ============================================================
-- Supabase Dashboard > Storage 에서 "photos" 버킷 생성
-- 정책: 인증된 사용자가 본인 폴더(user_id/)에만 업로드/삭제 가능
--
-- INSERT policy: (bucket_id = 'photos') AND (auth.uid()::text = (storage.foldername(name))[1])
-- SELECT policy: (bucket_id = 'photos') AND (auth.uid()::text = (storage.foldername(name))[1])
-- DELETE policy: (bucket_id = 'photos') AND (auth.uid()::text = (storage.foldername(name))[1])

-- ============================================================
-- STEP 5.5: photos 조회 정책 — 본인 데이터만 (민감 컬럼 보호)
-- ============================================================
--
-- ⚠️ 과거 "photos_select_location_all" 정책(auth.uid() IS NOT NULL)은
--    RLS가 row-level이라 컬럼을 가리지 못해, 로그인한 누구나 타인의
--    storage_path / gemini_raw / 정확한 GPS 전체 행을 SELECT할 수 있었다.
--    → 해당 정책을 제거하고 본인 전용 SELECT로 되돌린다.
--    타 유저의 "비민감" 정보(위치/카테고리/시군구)는 STEP 7의
--    photos_public 뷰를 통해서만 노출한다(민감 컬럼은 뷰에서 제외).

-- 과거의 과도하게 넓은 정책 제거
DROP POLICY IF EXISTS "photos_select_location_all" ON public.photos;

-- 본인 데이터만 직접 조회 가능하도록 복구
DROP POLICY IF EXISTS "photos_select_own" ON public.photos;
CREATE POLICY "photos_select_own" ON public.photos
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- STEP 6: 랭킹 시스템 — district_code 컬럼 & RPC 함수
-- ============================================================

-- 시/군/구 코드 컬럼 추가
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS district_code TEXT;
CREATE INDEX IF NOT EXISTS idx_photos_district ON public.photos (district_code);

-- 간편가입(이름·소속·4자리)용 프로필 컬럼 — 이미 배포된 DB 대비 idempotent 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_last4 TEXT;

-- 랭킹 데이터 조회 (SECURITY DEFINER — RLS 우회하여 집계 데이터만 반환)
CREATE OR REPLACE FUNCTION public.get_ranking(rank_scope TEXT DEFAULT 'national')
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  trash_count BIGINT,
  total_impact NUMERIC,
  top_district TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    pr.display_name,
    pr.avatar_url,
    COUNT(*)::BIGINT AS trash_count,
    COALESCE(SUM(p.pollution_impact), 0) AS total_impact,
    MODE() WITHIN GROUP (ORDER BY p.district_code) AS top_district
  FROM public.photos p
  JOIN public.profiles pr ON pr.id = p.user_id
  GROUP BY p.user_id, pr.display_name, pr.avatar_url
  ORDER BY COUNT(*) DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 특정 유저의 경로 좌표 조회 (민감 데이터 미노출)
CREATE OR REPLACE FUNCTION public.get_user_routes(target_user_id UUID)
RETURNS TABLE (
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  district_code TEXT,
  captured_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.latitude, p.longitude, p.district_code, p.captured_at
  FROM public.photos p
  WHERE p.user_id = target_user_id
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
  ORDER BY p.captured_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 특정 유저의 시군구별 방문 빈도
CREATE OR REPLACE FUNCTION public.get_user_district_stats(target_user_id UUID)
RETURNS TABLE (
  district_code TEXT,
  visit_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.district_code, COUNT(*)::BIGINT
  FROM public.photos p
  WHERE p.user_id = target_user_id
    AND p.district_code IS NOT NULL
  GROUP BY p.district_code
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 7: 공개 뷰 — 타 유저의 비민감 정보만 노출 (랭킹/경로 비교용)
-- ============================================================
--
-- 직접 쿼리 방식을 유지하면서 컬럼 노출만 차단한다.
-- ⚠️ 이 뷰는 반드시 security_invoker=false(기본값)로 유지해야 한다.
--    소유자(postgres) 권한으로 실행되어 photos의 RLS를 우회하므로
--    모든 유저의 행이 보이되, SELECT 목록에 없는 storage_path /
--    gemini_raw 는 애초에 노출되지 않는다. (위치/경로는 "다른 유저 경로
--    비교" 기능의 핵심이라 의도적으로 포함)
--    security_invoker=true 로 바꾸면 본인 행만 보여 랭킹/비교가 깨진다.
--    (WITH 절을 생략한 이유: PG15 미만 호환 — false가 기본 동작)

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

-- 인증된 유저만 공개 뷰 조회 가능 (storage_path/gemini_raw 컬럼은 뷰에 없음)
REVOKE ALL ON public.photos_public FROM anon;
GRANT SELECT ON public.photos_public TO authenticated;

-- PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 완료!
-- ============================================================
