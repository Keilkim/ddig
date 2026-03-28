'use strict';

var _HTML_RANKING_VIEW = '' +
  '<div class="ranking-display" style="display:none">' +
    '<div class="ranking-sub-tabs">' +
      '<button class="ranking-sub-tab ranking-sub-tab-active" data-rank="neighborhood" onclick="switchRankingTab(\'neighborhood\')">내 동네</button>' +
      '<button class="ranking-sub-tab" data-rank="district" onclick="switchRankingTab(\'district\')">시군구</button>' +
      '<button class="ranking-sub-tab" data-rank="national" onclick="switchRankingTab(\'national\')">전체</button>' +
    '</div>' +
    '<div id="ranking-content" class="ranking-content">' +
      '<div class="ranking-empty">랭킹을 확인하려면 탭을 선택하세요</div>' +
    '</div>' +
  '</div>' +
  /* Tab 3: 숨김 패널 */
  '<div class="extra-display" style="display:none">' +
    '<div class="ranking-empty">준비 중입니다</div>' +
  '</div>';
