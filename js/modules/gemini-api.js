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
    '이 사진에 있는 쓰레기를 분석해주세요. 반드시 아래 JSON 형식으로만 응답하세요.\n\n' +
    '{\n' +
    '  "trash_category": "plastic|paper|glass|metal|organic|cigarette|other 중 하나",\n' +
    '  "pollution_impact": 1에서 10 사이의 숫자 (방치 시 오염 영향력),\n' +
    '  "description": "쓰레기에 대한 한국어 한줄 설명"\n' +
    '}\n\n' +
    '쓰레기가 보이지 않으면 trash_category를 "other"로, pollution_impact를 1로 설정하세요.';

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
      trash_category: parsed.trash_category || 'other',
      pollution_impact: Number(parsed.pollution_impact) || 1,
      description: parsed.description || ''
    };
  } catch (err) {
    console.error('Gemini 분석 오류:', err);
    return null;
  }
}
