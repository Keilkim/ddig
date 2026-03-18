'use strict';

/* ════════════════════════════════════════
   Gemini API 모듈 — 쓰레기 이미지 분석
   + 로컬 키워드 분류기로 카테고리 보정
   ════════════════════════════════════════ */

var GEMINI_MODEL = 'gemini-2.0-flash';

/* ─── 키워드 기반 카테고리 분류 테이블 ─── */
var _CLASSIFY_RULES = [
  {
    category: 'plastic',
    keywords: [
      '페트', 'pet', '페트병', '플라스틱', 'plastic', '비닐', '비닐봉투', '비닐봉지',
      '봉투', '포장재', '포장지', '랩', '용기', '플라스틱컵', '플컵', '빨대', 'straw',
      '스티로폼', 'styrofoam', '택배봉투', '에어캡', '뽁뽁이', '일회용',
      '일회용컵', '테이크아웃', '음료컵', '아이스컵', '물병', '생수병', '생수',
      '음료수병', '음료병', '주스병', 'bottle', '요거트', '요구르트',
      'pp', 'pe', 'ps', 'pvc', 'hdpe', 'ldpe', 'pet병',
      '세제', '샴푸', '린스', '화장품', '튜브', '칫솔',
      '젓가락', '수저', '포크', '나이프', '스푼'
    ]
  },
  {
    category: 'paper',
    keywords: [
      '종이', 'paper', '박스', '상자', '택배', '택배박스', '골판지',
      '종이컵', '종이봉투', '신문', '신문지', '전단지', '전단', '광고지',
      '영수증', '영수', '카드보드', 'cardboard', '포장박스',
      '잡지', '책', '노트', '서류', '문서', '편지', '봉투', '우편',
      '화장지', '티슈', '냅킨', '키친타올', '휴지',
      '우유팩', '주스팩', '종이팩', '종이가방', '쇼핑백'
    ]
  },
  {
    category: 'glass',
    keywords: [
      '유리', 'glass', '유리병', '소주병', '맥주병', '와인병',
      '거울', '유리잔', '유리컵', '유리조각', '깨진유리',
      '유리용기', '잼병', '소스병', '식초병'
    ]
  },
  {
    category: 'metal',
    keywords: [
      '캔', 'can', '알루미늄', 'aluminum', '철', 'metal', '금속',
      '맥주캔', '음료캔', '콜라캔', '사이다캔', '에너지드링크',
      '병뚜껑', '뚜껑', '철사', '못', '나사', '볼트',
      '통조림', '참치캔', '스팸', '깡통', '호일', '알루미늄호일',
      '철캔', '양철', '구리', '동전'
    ]
  },
  {
    category: 'organic',
    keywords: [
      '음식', 'food', '음식물', '과일', '껍질', '껍데기',
      '바나나', '사과', '귤', '오렌지', '수박', '참외',
      '채소', '야채', '밥', '빵', '면', '국',
      '뼈', '생선', '고기', '달걀', '계란', '두부',
      '나뭇잎', '나뭇가지', '풀', '꽃', '낙엽'
    ]
  },
  {
    category: 'cigarette',
    keywords: [
      '담배', 'cigarette', '꽁초', '담배꽁초', '담배갑', '필터',
      '라이터', 'lighter', '재떨이', '전자담배', '아이코스', '릴',
      '줄', 'juul', '연초', '흡연'
    ]
  }
];

/* ─── 키워드 매칭으로 카테고리 결정 ─── */
function classifyByKeywords(text) {
  if (!text) return null;
  var lower = text.toLowerCase().replace(/\s+/g, '');

  var bestMatch = null;
  var bestScore = 0;

  for (var i = 0; i < _CLASSIFY_RULES.length; i++) {
    var rule = _CLASSIFY_RULES[i];
    var score = 0;
    for (var j = 0; j < rule.keywords.length; j++) {
      if (lower.indexOf(rule.keywords[j]) !== -1) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule.category;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

/* ─── 분석 결과에서 모든 텍스트 추출하여 분류 ─── */
function correctCategory(parsed) {
  // 모든 텍스트를 합쳐서 키워드 매칭
  var allText = (parsed.description || '') + ' ' + (parsed.trash_category || '');

  if (Array.isArray(parsed.objects)) {
    for (var i = 0; i < parsed.objects.length; i++) {
      allText += ' ' + (parsed.objects[i].label || '');
    }
  }

  var detected = classifyByKeywords(allText);
  if (detected) return detected;

  // Gemini가 영문 카테고리를 정상적으로 줬으면 그대로
  var validCategories = ['plastic', 'paper', 'glass', 'metal', 'organic', 'cigarette'];
  var geminiCat = (parsed.trash_category || '').toLowerCase();
  if (validCategories.indexOf(geminiCat) !== -1) return geminiCat;

  // 한글 카테고리명 매핑
  var koreanMap = {
    '플라스틱': 'plastic', '비닐': 'plastic', '페트': 'plastic', '스티로폼': 'plastic',
    '종이': 'paper', '박스': 'paper', '골판지': 'paper',
    '유리': 'glass',
    '금속': 'metal', '캔': 'metal', '알루미늄': 'metal',
    '음식물': 'organic', '유기물': 'organic',
    '담배': 'cigarette', '꽁초': 'cigarette'
  };

  for (var key in koreanMap) {
    if (allText.indexOf(key) !== -1) return koreanMap[key];
  }

  return 'other';
}

/* ─── 이미지 분석 ─── */
async function analyzePhoto(base64Image) {
  if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
    console.warn('Gemini API 키 미설정');
    return null;
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  var prompt =
    'You are a trash classification AI. Analyze this image for litter/trash.\n\n' +
    'IMPORTANT: You MUST classify trash_category as one of these exact English words:\n' +
    '- "plastic" - PET bottles, plastic containers, vinyl bags, plastic wrap, cups, straws, styrofoam\n' +
    '- "paper" - cardboard boxes, paper cups, newspapers, flyers, receipts, delivery boxes\n' +
    '- "glass" - glass bottles, broken glass, mirrors\n' +
    '- "metal" - aluminum cans, steel cans, metal pieces, bottle caps\n' +
    '- "organic" - food waste, fruit peels, dead leaves\n' +
    '- "cigarette" - cigarette butts, cigarette packs, lighters\n' +
    '- "other" - ONLY if absolutely none of the above categories fit\n\n' +
    'RULES:\n' +
    '- PET bottle / water bottle / beverage bottle = "plastic" (NOT glass)\n' +
    '- Vinyl bag / plastic bag = "plastic"\n' +
    '- Delivery box / cardboard = "paper"\n' +
    '- Styrofoam = "plastic"\n' +
    '- DO NOT use "other" if any of the 6 categories above can apply\n\n' +
    'BOUNDING BOX: For each detected object, provide bbox as [y_min, x_min, y_max, x_max]\n' +
    'Each value is normalized 0-1000 (top-left is 0,0, bottom-right is 1000,1000)\n\n' +
    'Respond ONLY with this JSON (no other text):\n' +
    '{"is_trash":true,"trash_category":"plastic","pollution_impact":5,' +
    '"description":"한국어 설명",' +
    '"objects":[{"label":"한국어 물체명","confidence":0.92,"bbox":[100,200,500,600]}]}\n\n' +
    'If no trash: {"is_trash":false,"trash_category":"none","pollution_impact":0,' +
    '"description":"한국어 설명","objects":[]}';

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
    console.log('[Gemini 원본 응답]', text);

    // JSON 추출
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    var parsed = JSON.parse(jsonMatch[0]);

    // bbox 형식 변환: Gemini [y_min, x_min, y_max, x_max] → 내부 [x_min, y_min, x_max, y_max]
    var objects = [];
    if (Array.isArray(parsed.objects)) {
      for (var i = 0; i < parsed.objects.length; i++) {
        var obj = parsed.objects[i];
        var bbox = obj.bbox;
        if (bbox && bbox.length >= 4) {
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

    // 로컬 키워드 분류기로 카테고리 보정
    var category = correctCategory(parsed);
    console.log('[카테고리 보정]', parsed.trash_category, '->', category);

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
