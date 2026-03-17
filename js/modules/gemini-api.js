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
    '이 사진을 분석해주세요. 반드시 아래 JSON 형식으로만 응답하세요.\n\n' +
    '{\n' +
    '  "is_trash": true 또는 false (쓰레기가 보이는지 여부),\n' +
    '  "trash_category": "plastic|paper|glass|metal|organic|cigarette|other 중 하나 (쓰레기가 아니면 none)",\n' +
    '  "pollution_impact": 1에서 10 사이의 숫자 (쓰레기가 아니면 0),\n' +
    '  "description": "한국어 한줄 설명 (쓰레기가 아니면 무엇이 보이는지 설명)",\n' +
    '  "objects": [\n' +
    '    {\n' +
    '      "label": "감지된 물체 이름",\n' +
    '      "confidence": 0.0에서 1.0 사이의 신뢰도,\n' +
    '      "bbox": [x_min, y_min, x_max, y_max] (0~1000 사이 정규화 좌표)\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    '사진에서 보이는 모든 쓰레기 및 주요 물체를 objects 배열에 포함하세요.\n' +
    'bbox는 이미지 크기 대비 0~1000 사이로 정규화된 좌표입니다.\n' +
    '쓰레기가 전혀 없으면 is_trash를 false로 설정하세요.';

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
      temperature: 0.2,
      maxOutputTokens: 256
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
    return {
      is_trash: parsed.is_trash !== false,
      trash_category: parsed.is_trash === false ? 'none' : (parsed.trash_category || 'other'),
      pollution_impact: parsed.is_trash === false ? 0 : (Number(parsed.pollution_impact) || 1),
      description: parsed.description || '',
      objects: Array.isArray(parsed.objects) ? parsed.objects : []
    };
  } catch (err) {
    console.error('Gemini 분석 오류:', err);
    return null;
  }
}
