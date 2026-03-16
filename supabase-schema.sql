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
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
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
-- 완료!
-- ============================================================
