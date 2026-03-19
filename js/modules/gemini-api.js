'use strict';

/* ════════════════════════════════════════
   Gemini API 모듈 — 쓰레기 이미지 분석
   환경부고시 제2022-254호 (2024.1.1 시행)
   「분리배출 표시에 관한 지침」 기반 분류
   + 로컬 키워드 분류기로 카테고리 보정
   ════════════════════════════════════════ */

var GEMINI_MODEL = 'gemini-2.0-flash';

/*
 * 분류 근거: 환경부고시 제2022-254호
 * 「분리배출 표시에 관한 지침」 (2022.12.23 공포, 2024.1.1 시행)
 *
 * 공식 9개 카테고리:
 *  1. paper      — 종이류
 *  2. paperpack  — 종이팩 (일반팩/멸균팩)
 *  3. glass      — 유리류
 *  4. can        — 캔류 (철/알루미늄)
 *  5. plastic    — 플라스틱류 (PET, HDPE, PP, PS 등 용기·트레이형)
 *  6. vinyl      — 비닐류 (필름·시트형)
 *  7. styrofoam  — 스티로폼 (발포합성수지)
 *  8. cigarette  — 담배꽁초 (일반쓰레기)
 *  9. other      — 기타 / 일반쓰레기
 */

/* ─── 키워드 기반 카테고리 분류 테이블 ─── */
var _CLASSIFY_RULES = [
  {
    category: 'plastic',
    keywords: [
      '페트', 'pet', '페트병', '플라스틱', 'plastic', '용기', '트레이',
      '플라스틱컵', '플컵', '빨대', 'straw', '일회용컵', '테이크아웃',
      '음료컵', '아이스컵', '물병', '생수병', '생수', '음료수병', '음료병',
      '주스병', 'bottle', '요거트', '요구르트', '플라스틱병',
      'pp', 'pe', 'ps', 'pvc', 'hdpe', 'ldpe', 'pet병', 'other',
      '세제통', '샴푸통', '린스통', '화장품용기', '튜브', '칫솔',
      '젓가락', '수저', '포크', '나이프', '스푼', '일회용'
    ]
  },
  {
    category: 'vinyl',
    keywords: [
      '비닐', '비닐봉투', '비닐봉지', '봉투', '포장재', '포장지', '랩',
      '택배봉투', '에어캡', '뽁뽁이', '필름', '시트', '지퍼백',
      '과자봉지', '라면봉지', '식품포장', '쓰레기봉투',
      'vinyl', 'film', 'wrap', 'bag', '봉지'
    ]
  },
  {
    category: 'styrofoam',
    keywords: [
      '스티로폼', 'styrofoam', '발포', '완충재', '아이스박스',
      '포장스티로폼', '스치로폼', 'eps', '발포합성수지'
    ]
  },
  {
    category: 'paper',
    keywords: [
      '종이', 'paper', '박스', '상자', '택배', '택배박스', '골판지',
      '종이컵', '종이봉투', '신문', '신문지', '전단지', '전단', '광고지',
      '영수증', '영수', '카드보드', 'cardboard', '포장박스',
      '잡지', '책', '노트', '서류', '문서', '편지', '우편',
      '화장지', '티슈', '냅킨', '키친타올', '휴지', '종이가방', '쇼핑백'
    ]
  },
  {
    category: 'paperpack',
    keywords: [
      '우유팩', '주스팩', '종이팩', '멸균팩', '살균팩', '일반팩',
      '두유팩', '음료팩', 'tetra', '테트라팩', '팩'
    ]
  },
  {
    category: 'glass',
    keywords: [
      '유리', 'glass', '유리병', '소주병', '맥주병', '와인병',
      '거울', '유리잔', '유리컵', '유리조각', '깨진유리',
      '유리용기', '잼병', '소스병', '식초병', '음료수유리'
    ]
  },
  {
    category: 'can',
    keywords: [
      '캔', 'can', '알루미늄', 'aluminum', '철', 'metal', '금속',
      '맥주캔', '음료캔', '콜라캔', '사이다캔', '에너지드링크',
      '병뚜껑', '뚜껑', '통조림', '참치캔', '스팸', '깡통',
      '호일', '알루미늄호일', '철캔', '양철', '알미늄'
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
  var allText = (parsed.description || '') + ' ' + (parsed.trash_category || '');

  if (Array.isArray(parsed.objects)) {
    for (var i = 0; i < parsed.objects.length; i++) {
      allText += ' ' + (parsed.objects[i].label || '');
    }
  }

  var detected = classifyByKeywords(allText);
  if (detected) return detected;

  // Gemini 영문 카테고리 직접 매핑
  var validCategories = ['plastic', 'vinyl', 'styrofoam', 'paper', 'paperpack', 'glass', 'can', 'cigarette'];
  var geminiCat = (parsed.trash_category || '').toLowerCase();
  if (validCategories.indexOf(geminiCat) !== -1) return geminiCat;

  // Gemini가 옛 카테고리명(metal, organic)을 줬을 때 매핑
  if (geminiCat === 'metal') return 'can';

  // 한글 카테고리명 매핑
  var koreanMap = {
    '플라스틱': 'plastic', '페트': 'plastic',
    '비닐': 'vinyl', '봉투': 'vinyl', '필름': 'vinyl',
    '스티로폼': 'styrofoam', '발포': 'styrofoam',
    '종이': 'paper', '박스': 'paper', '골판지': 'paper',
    '종이팩': 'paperpack', '우유팩': 'paperpack', '멸균팩': 'paperpack',
    '유리': 'glass',
    '금속': 'can', '캔': 'can', '알루미늄': 'can', '철': 'can',
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
    'You are a trash/litter classification AI for a Korean plogging app.\n' +
    'Classify based on Korea Ministry of Environment guidelines (환경부고시 제2022-254호).\n\n' +
    'CATEGORIES (use exact English key):\n' +
    '- "plastic" — PET bottles, plastic containers, trays, cups, straws, cutlery\n' +
    '- "vinyl" — plastic bags, wrap, film, food packaging bags, bubble wrap\n' +
    '- "styrofoam" — styrofoam, EPS, foam packaging\n' +
    '- "paper" — cardboard boxes, newspapers, paper cups, receipts, flyers\n' +
    '- "paperpack" — milk cartons, juice packs, tetra paks\n' +
    '- "glass" — glass bottles (soju, beer, wine, sauce)\n' +
    '- "can" — aluminum cans, steel cans, tin cans, bottle caps, foil\n' +
    '- "cigarette" — cigarette butts, packs, lighters\n' +
    '- "other" — only if none of the above fits\n\n' +
    'RULES:\n' +
    '- PET bottle = "plastic" (NOT glass)\n' +
    '- Plastic bag / vinyl bag = "vinyl" (NOT plastic)\n' +
    '- Styrofoam = "styrofoam" (NOT plastic)\n' +
    '- Metal can = "can"\n' +
    '- Milk/juice carton = "paperpack"\n' +
    '- DO NOT use "other" unless truly unclassifiable\n\n' +
    'BOUNDING BOX: [y_min, x_min, y_max, x_max], values 0-1000\n\n' +
    'Respond ONLY with JSON:\n' +
    '{"is_trash":true,"trash_category":"plastic",' +
    '"description":"한국어 설명",' +
    '"objects":[{"label":"한국어 물체명","confidence":0.92,"bbox":[100,200,500,600]}]}\n\n' +
    'No trash: {"is_trash":false,"trash_category":"none","description":"한국어 설명","objects":[]}';

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

    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    var parsed = JSON.parse(jsonMatch[0]);

    // bbox 변환
    var objects = [];
    if (Array.isArray(parsed.objects)) {
      for (var i = 0; i < parsed.objects.length; i++) {
        var obj = parsed.objects[i];
        var bbox = obj.bbox;
        console.log('[Gemini bbox 원본]', obj.label, bbox);
        if (bbox && bbox.length >= 4) {
          if (bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 0 && bbox[3] === 0) continue;
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
    console.log('[변환된 objects]', JSON.stringify(objects));

    var category = correctCategory(parsed);
    console.log('[카테고리 보정]', parsed.trash_category, '->', category);

    return {
      is_trash: parsed.is_trash !== false,
      trash_category: parsed.is_trash === false ? 'none' : category,
      description: parsed.description || '',
      objects: objects
    };
  } catch (err) {
    console.error('Gemini 분석 오류:', err);
    return null;
  }
}
