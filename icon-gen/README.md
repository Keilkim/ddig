# icon-gen — 앱 아이콘 생성기 (로컬 전용)

OpenAI 이미지 API로 DIGG 앱의 **손그림(검은 펜) 아이콘**을 만들어, 무손실 WebP로 최적화해
`assets/icons/` 에 떨어뜨리는 도구입니다. 앱은 이 WebP를 곧바로 참조합니다([js/html/icons.js](../js/html/icons.js) 의 `iconImg()`).

**2단계 파이프라인**

```
generate.mjs  → 1024px PNG 마스터        (icon-gen/output/, git 제외)
optimize.mjs  → 무손실 WebP(128/256px)   (assets/icons/, 커밋·배포 대상)
```

> ⚠️ 이 폴더(`icon-gen/`)는 **Vercel 배포에서 제외**(`.vercelignore`), `.env`(키)·`output/`(PNG 마스터)는 git 제외.
> 단, 최종 **WebP는 `assets/icons/`** 로 떨어지며 이쪽은 배포·커밋 대상입니다.

---

## 스타일 / 동작 (한눈에)

- **스타일**: 검은 펜 손그림 — 라운드 코너, 외곽선 굵게·내부선 얇게, 내부는 빗금(hatching) 채움, 2D 플랫, 그림자/색 없음, **투명 배경**.
- **모델**: `gpt-image-1` (투명 배경 지원). 톤·모델·사이즈·품질은 [`config.json`](./config.json) 에서 조정.
- **출력**: `assets/icons/<name>.webp` — 무손실, 표시 크기에 맞춘 128/256px. 에셋이 없으면 앱은 자동으로 이모지 폴백(안 깨짐).

## 폴더 구성

```
icon-gen/
├─ .env             ← OpenAI API 키 (git 제외)
├─ config.json      ← 모델/사이즈/품질/배경 + 공통 스타일 프롬프트
├─ icons.json       ← "무엇을 만들지" 리스트 (이 name 들을 앱이 참조)
├─ prompts.md       ← 프롬프트 작성 가이드
├─ generate.mjs     ← 생성 스크립트 (1024 PNG 마스터, 의존성 없음, Node 18+)
├─ optimize.mjs     ← 최적화 스크립트 (PNG 마스터 → 무손실 WebP, cwebp 필요)
├─ output/          ← PNG 마스터 (git 제외)
└─ package.json     ← npm 스크립트
```

---

## 1) 처음 한 번: API 키 + cwebp

`.env` 에 키가 있어야 합니다 (없으면 생성):

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

최적화에는 `cwebp` 가 필요합니다: `brew install webp`.

> 키 발급: https://platform.openai.com/api-keys — 이미지 모델 사용에는 결제수단/조직 인증이 필요할 수 있습니다.

## 2) 만들 아이콘

[`icons.json`](./icons.json) 의 `items` 에 정의돼 있습니다. **name 은 앱이 참조하는 파일명이라 임의로 바꾸지 마세요.**
새 아이콘은 항목을 추가하고 앱에서도 `iconImg('<name>')` 로 연결하세요. (크게 표시할 아이콘이면 `optimize.mjs` 의 `LARGE` 셋에 이름을 넣어 256px로 뽑으세요. 기본은 128px.)

```json
{ "name": "ui-bell", "prompt": "a notification bell" }
```

- `name` → `assets/icons/ui-bell.webp`
- `prompt` → "무엇을" 그릴지(Subject)만. 스타일은 `config.json` 의 `stylePrompt` 가 앞에 자동으로 붙습니다.

## 3) 생성 → 최적화

```bash
cd icon-gen
node generate.mjs        # 1) 1024 PNG 마스터 생성 (있으면 건너뜀, --force 로 재생성)
node optimize.mjs        # 2) 무손실 WebP 로 변환 → assets/icons/

# 한 번에:
npm run build            # = generate.mjs && optimize.mjs
# 기타: npm run gen / opt / list / dry / gen:force
```

- `node generate.mjs --only trophy,medal-gold` / `node optimize.mjs --only trophy` — 일부만.
- 톤 어긋난 항목만: `node generate.mjs --force --only <name>` 후 `node optimize.mjs --only <name>`.
- 변환 후 앱 새로고침하면 바로 반영됩니다.

---

## 톤/스타일·해상도 바꾸기

[`config.json`](./config.json) 의 `stylePrompt` 한 줄로 **공통 톤**이 바뀝니다. 모델·사이즈·품질·배경도 같은 파일.

| 항목 | 값 |
|------|-----|
| `model` | `gpt-image-1` (투명 배경 지원) |
| `size` | `1024x1024` (마스터 해상도) |
| `quality` | `low` / `medium` / `high` / `auto` (생성 품질) |
| `background` | `transparent` (검은 펜 아이콘이라 투명 필수) |
| `outputDir` | `output` (PNG 마스터 저장 위치) |

배포 해상도(WebP)는 [`optimize.mjs`](./optimize.mjs) 의 `LARGE`(256px) / 기본(128px) 로 조정합니다.

---

## 문제 해결 / 주의

- **`OpenAI API 키가 설정되지 않았습니다`** → `.env` 의 `OPENAI_API_KEY` 확인.
- **`billing_hard_limit_reached`** → OpenAI 결제 한도 초과. 대시보드 Billing 한도 상향/충전 후 재실행.
- **`HTTP 401`** → 키 오류/만료. **`HTTP 429`** → 레이트리밋(자동 재시도, `concurrency` 낮추기). **`HTTP 403 / must be verified`** → 조직 인증 후 이미지 모델 권한 켜기.
- **`cwebp 가 없습니다`** → `brew install webp`.
- **gpt-image-1 이 막혀 있으면** → `config.json` 의 `model` 을 `gpt-image-2`, `background` 를 `opaque` 로 바꿔 흰 배경으로 뽑은 뒤, 배경을 직접 누끼따서 마스터로 쓰세요(gpt-image-2 는 투명 미지원).
- **세트 일관성**: 생성은 호출마다 달라 톤이 흔들릴 수 있습니다. 어긋난 항목만 `--force --only <name>` 으로 다시 뽑으세요.
- **API 키 커밋 금지.** 키는 `.env` 에만.
