-- ============================================================
-- 간편 로그인 마이그레이션 (이름 + 소속 + 핸드폰 뒤 4자리)
-- 오늘 행사 운영용 — Supabase SQL Editor에서 이 파일 전체를 실행하세요.
-- 안전하게 여러 번 실행해도 됩니다(idempotent).
-- ============================================================

-- 1) 프로필에 소속 / 핸드폰 뒤 4자리 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_last4 TEXT;

-- 2) 가입 트리거 교체 — 구글 OAuth & 간편가입 모두 profiles 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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

-- 트리거가 없다면 생성(이미 있으면 그대로)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ⚠️ 코드로 불가 — 대시보드에서 직접 설정해야 합니다:
--   Authentication → Sign In / Providers → Email →
--     "Confirm email" 끄기 (OFF)
--   안 끄면 간편가입 후 세션이 발급되지 않아 로그인되지 않습니다.
-- ============================================================
