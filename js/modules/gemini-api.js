'use strict';

/* ════════════════════════════════════════
   Gemini API 모듈 — 쓰레기 이미지 분석
   ════════════════════════════════════════ */

var GEMINI_MODEL = 'gemini-2.0-flash';

/* ─── 이미지 분석 ─── */
async function analyzePhoto(base64Image) {
  if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
    console.warn('Gemini API 키 미설정');
    return null;
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  var prompt =
    '당신은 쓰레기 분류 전문 AI입니다. 이 사진에서 쓰레기를 찾아 분석하세요.\n\n' +
    '## 카테고리 분류 기준 (반드시 아래 중 하나 선택):\n' +
    '- plastic: 페트병, 플라스틱 용기, 비닐봉투, 비닐 포장재, 플라스틱 컵, 빨대, 스티로폼\n' +
    '- paper: 종이박스, 종이컵, 신문지, 전단지, 종이 포장재, 영수증, 택배박스\n' +
    '- glass: 유리병, 유리 조각, 거울 파편\n' +
    '- metal: 알루미늄 캔, 철캔, 금속 조각, 병뚜껑\n' +
    '- organic: 음식물 쓰레기, 과일 껍질, 나뭇가지(버려진 것)\n' +
    '- cigarette: 담배꽁초, 담배갑, 라이터\n' +
    '- other: 위 어디에도 해당하지 않는 쓰레기\n\n' +
    '## 중요 규칙:\n' +
    '- 페트병/음료수병 → plastic (glass 아님)\n' +
    '- 비닐봉투/비닐 → plastic\n' +
    '- 택배박스/종이박스 → paper\n' +
    '- 스티로폼 → plastic\n' +
    '- other는 정말 분류 불가능한 경우에만 사용\n\n' +
    '## 바운딩박스 규칙:\n' +
    '- 각 쓰레기 물체의 위치를 정확히 bbox로 표시\n' +
    '- bbox는 [y_min, x_min, y_max, x_max] 형식, 각 값은 0~1000 정규화 좌표\n' +
    '- 이미지 왼쪽 상단이 (0,0), 오른쪽 하단이 (1000,1000)\n\n' +
    '반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:\n\n' +
    '{\n' +
    '  "is_trash": true,\n' +
    '  "trash_category": "plastic",\n' +
    '  "pollution_impact": 5,\n' +
    '  "description": "한국어 한줄 설명",\n' +
    '  "objects": [\n' +
    '    {"label": "페트병", "confidence": 0.92, "bbox": [100, 200, 500, 600]}\n' +
    '  ]\n' +
    '}\n\n' +
    '쓰레기가 없으면 is_trash를 false, trash_category를 "none"으로 설정.';

  var body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024
    }
  };

  try {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('Gemini API 오류:', response.status);
      return null;
    }

    var result = await response.json();
    var text = result.candidates[0].content.parts[0].text;

    // JSON 추출 (마크다운 코드블록 제거)
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    var parsed = JSON.parse(jsonMatch[0]);

    // bbox 형식 변환: Gemini는 [y_min, x_min, y_max, x_max] 반환
    var objects = [];
    if (Array.isArray(parsed.objects)) {
      for (var i = 0; i < parsed.objects.length; i++) {
        var obj = parsed.objects[i];
        var bbox = obj.bbox;
        if (bbox && bbox.length >= 4) {
          // Gemini: [y_min, x_min, y_max, x_max] → 내부: [x_min, y_min, x_max, y_max]
          objects.push({
            label: obj.label || '물체',
            confidence: Number(obj.confidence) || 0.5,
            bbox: [bbox[1], bbox[0], bbox[3], bbox[2]]
          });
        } else {
          objects.push({
            label: obj.label || '물체',
            confidence: Number(obj.confidence) || 0.5,
            bbox: null
          });
        }
      }
    }

    // 카테고리 유효성 검증
    var validCategories = ['plastic', 'paper', 'glass', 'metal', 'organic', 'cigarette', 'other', 'none'];
    var category = (parsed.trash_category || '').toLowerCase();
    if (validCategories.indexOf(category) === -1) category = 'other';

    return {
      is_trash: parsed.is_trash !== false,
      trash_category: parsed.is_trash === false ? 'none' : category,
      pollution_impact: parsed.is_trash === false ? 0 : (Number(parsed.pollution_impact) || 1),
      description: parsed.description || '',
      objects: objects
    };
  } catch (err) {
    console.error('Gemini 분석 오류:', err);
    return null;
  }
}
