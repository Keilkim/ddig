# icon-gen — 앱 아이콘 생성기 (로컬 전용)

OpenAI 이미지 API로 DIGG 앱의 **손그림(검은 펜) 아이콘**을 만들어 `assets/icons/` 에 바로 떨어뜨리는 도구입니다.
생성된 PNG는 앱이 곧바로 참조합니다([js/html/icons.js](../js/html/icons.js) 의 `iconImg()`).

> ⚠️ 이 폴더(`icon-gen/`)는 **Vercel 배포에서 제외**됩니다(`.vercelignore`). `.env`(API 키)도 git에 올라가지 않습니다(`.gitignore`).
> 단, **생성 결과물은 `assets/icons/` 로 떨어지며 이쪽은 배포·커밋 대상**입니다. (예전처럼 `icon-gen/output/` 에 쌓이지 않습니다.)

---

## 스타일 / 동작 (한눈에)

- **스타일**: 검은 펜 손그림 — 라운드 코너, 외곽선 굵게·내부선 얇게, 내부는 빗금(hatching) 채움, 2D 플랫, 그림자/색 없음, **투명 배경**.
- **모델**: `gpt-image-1` (투명 배경 지원). 톤·모델·사이즈·배경은 모두 [`config.json`](./config.json) 에서 조정.
- **출력**: `assets/icons/<name>.png` — 앱이 그대로 사용. 에셋이 아직 없으면 앱은 자동으로 이모지로 폴백합니다(깨지지 않음).

## 폴더 구성

```
icon-gen/
├─ .env             ← OpenAI API 키 (git 제외)
├─ config.json      ← 모델/사이즈/품질/배경 + 공통 스타일 프롬프트 + 출력경로
├─ icons.json       ← "무엇을 만들지" 리스트 (이 name 들을 앱이 참조)
├─ prompts.md       ← 프롬프트 작성 가이드
├─ generate.mjs     ← 생성 스크립트 (의존성 없음, Node 18+)
└─ package.json     ← npm 스크립트
```

---

## 1) 처음 한 번: API 키

`.env` 에 키가 들어 있어야 합니다 (없으면 생성):

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

> 키 발급: https://platform.openai.com/api-keys — 이미지 모델 사용에는 결제수단/조직 인증이 필요할 수 있습니다.

## 2) 만들 아이콘

[`icons.json`](./icons.json) 의 `items` 에 정의돼 있습니다. **name 은 앱이 참조하는 파일명이라 임의로 바꾸지 마세요.**
새 아이콘을 추가하려면 항목을 넣고, 앱에서도 `iconImg('<name>')` 로 연결하세요.

```json
{ "name": "ui-bell", "prompt": "a notification bell" }
```

- `name` → `assets/icons/ui-bell.png`
- `prompt` → "무엇을" 그릴지(Subject)만. 스타일은 `config.json` 의 `stylePrompt` 가 앞에 자동으로 붙습니다.

## 3) 생성

```bash
cd icon-gen
node generate.mjs                 # 전체 생성 (이미 있는 파일은 건너뜀)
node generate.mjs --force         # 이미 있어도 덮어쓰기(톤 어긋난 것 재생성)
node generate.mjs --only trophy,medal-gold   # 일부만
node generate.mjs --list          # 만들 목록만 미리보기 (호출 X)
node generate.mjs --dry           # 최종 프롬프트만 출력 (호출 X)
```

또는: `npm run gen` / `npm run list` / `npm run dry`.

결과 PNG는 `assets/icons/` 에 저장되고, 앱을 새로고침하면 바로 반영됩니다.

---

## 톤/스타일 바꾸기

[`config.json`](./config.json) 의 `stylePrompt` 한 줄만 고치면 **모든 아이콘 공통 톤**이 바뀝니다. 모델·사이즈·품질·배경·출력경로도 같은 파일에서 조정합니다.

| 항목 | 값 |
|------|-----|
| `model` | `gpt-image-1` (투명 배경 지원) |
| `size` | `1024x1024` 등 |
| `quality` | `low` / `medium` / `high` / `auto` |
| `background` | `transparent` (검은 펜 아이콘이라 투명 필수) |
| `outputDir` | `../assets/icons` (앱이 참조하는 배포 경로) |

---

## 문제 해결 / 주의

- **`OpenAI API 키가 설정되지 않았습니다`** → `.env` 의 `OPENAI_API_KEY` 확인.
- **`HTTP 401`** → 키 오류/만료. **`HTTP 429`** → 레이트리밋(자동 재시도, `config.json` 의 `concurrency` 낮추기). **`HTTP 403 / must be verified`** → OpenAI 콘솔에서 조직 인증 후 이미지 모델 권한 켜기.
- **gpt-image-1 이 막혀 있으면** → `config.json` 의 `model` 을 `gpt-image-2`, `background` 를 `opaque` 로 바꿔 흰 배경으로 뽑은 뒤, 배경을 직접 누끼따서 `assets/icons/` 로 옮기세요(gpt-image-2 는 투명 미지원).
- **세트 일관성**: 생성은 호출마다 달라 톤이 흔들릴 수 있습니다. 어긋난 항목만 `--force --only <name>` 으로 다시 뽑으세요.
- **용량 최적화(선택)**: 1024px PNG는 큽니다. 표시 크기는 16–72px이므로 배포 전 다운스케일 권장 —
  `sips -Z 256 assets/icons/*.png` (macOS) 또는 `for f in assets/icons/*.png; do convert "$f" -resize 256x256 "$f"; done` (ImageMagick).
- **API 키 커밋 금지.** 키는 `.env` 에만.
