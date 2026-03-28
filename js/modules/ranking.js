'use strict';

/* ════════════════════════════════════════
   대쉬보드 탭 & 랭킹 모듈
   ════════════════════════════════════════ */

var _activeRankingTab = 'neighborhood';

/* ─── 대쉬보드 탭 전환 ─── */
function switchDashboardTab(tab) {
  var tabs = document.querySelectorAll('.dashboard-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('dashboard-tab-active', tabs[i].dataset.tab === tab);
  }

  var activityPanel = document.querySelector('.dashboard-display');
  var rankingPanel = document.querySelector('.ranking-display');
  var extraPanel = document.querySelector('.extra-display');

  if (activityPanel) activityPanel.style.display = tab === 'activity' ? '' : 'none';
  if (rankingPanel) rankingPanel.style.display = tab === 'ranking' ? '' : 'none';
  if (extraPanel) extraPanel.style.display = tab === 'extra' ? '' : 'none';

  if (tab === 'ranking') {
    loadRanking(_activeRankingTab);
  }
}

/* ─── 랭킹 서브탭 전환 ─── */
function switchRankingTab(rankType) {
  _activeRankingTab = rankType;
  var subTabs = document.querySelectorAll('.ranking-sub-tab');
  for (var i = 0; i < subTabs.length; i++) {
    subTabs[i].classList.toggle('ranking-sub-tab-active', subTabs[i].dataset.rank === rankType);
  }
  loadRanking(rankType);
}

/* ─── 랭킹 데이터 로드 (placeholder) ─── */
function loadRanking(rankType) {
  var content = document.getElementById('ranking-content');
  if (!content) return;

  var labels = {
    neighborhood: '내 동네',
    district: '시군구',
    national: '전체'
  };

  content.innerHTML =
    '<div class="ranking-empty">' +
      '<div style="font-size:40px;margin-bottom:12px">🏆</div>' +
      '<div>' + (labels[rankType] || '') + ' 랭킹</div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">준비 중입니다</div>' +
    '</div>';
}
