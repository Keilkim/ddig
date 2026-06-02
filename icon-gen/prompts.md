# 프롬프트 가이드

이 도구는 두 부분을 합쳐서 OpenAI 이미지 API에 보냅니다.

```
[ config.json 의 stylePrompt ]  +  "\n\nSubject: "  +  [ icons.json 항목의 prompt ]
```

즉 **공통 톤(스타일)은 `config.json` 의 `stylePrompt` 한 곳**에서 관리하고,
**개별 아이콘이 "무엇"을 그릴지는 `icons.json` 의 각 `prompt`(Subject)** 에 짧게 적습니다.

현재 톤: **검은 펜 손그림** — 라운드 코너, 외곽선 굵게·내부선 얇게, 내부는 빗금(hatching) 채움, 2D 플랫, 그림자/색 없음, 투명 배경. (무채색이라 강조색 지정은 사용하지 않습니다.)

---

## 좋은 아이콘 프롬프트 팁

- **무엇을 그릴지 명사 위주로** 적으세요. 스타일 형용사(손그림·빗금·투명 등)는 `stylePrompt` 가 이미 담당합니다.
- **한 화면에 사물 하나**만. 단순할수록 아이콘으로 쓰기 좋습니다.
- **글자 금지**가 기본입니다(`stylePrompt` 에 포함). 메달의 1·2·3 처럼 의미상 필요한 숫자는 Subject 에 명시하면 됩니다.
- **세트 일관성**이 중요하면 비슷한 시점/구도로 적으세요(예: 모두 "front view").

## 항목(icons.json) 작성 형식

```json
{
  "name": "ui-bell",                 // 파일명 → assets/icons/ui-bell.png (앱이 참조)
  "prompt": "a notification bell",   // Subject (무엇을)
  "size": "1024x1024",               // (선택) config 기본값 덮어쓰기
  "quality": "high",                 // (선택)
  "background": "transparent",       // (선택)
  "model": "gpt-image-1"             // (선택)
}
```

`size/quality/background/model` 은 생략하면 `config.json` 값이 그대로 쓰입니다.

> ⚠️ `name` 은 앱([js/html/icons.js](../js/html/icons.js))이 그대로 참조합니다. 새 아이콘을 추가하면
> 앱에서도 `iconImg('<name>')`(또는 카테고리면 `CATEGORY_ICON_MAP`)에 연결해야 실제로 보입니다.

## 자주 쓰는 명령

```bash
node generate.mjs                 # icons.json 전체 생성 (이미 있는 파일은 건너뜀)
node generate.mjs --force         # 이미 있어도 다시 생성(덮어쓰기)
node generate.mjs --only trophy,medal-gold   # 특정 아이콘만
node generate.mjs --list          # 생성될 목록만 미리보기 (호출 안 함)
node generate.mjs --dry           # 프롬프트만 출력하고 실제 호출 안 함
```
