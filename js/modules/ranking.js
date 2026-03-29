'use strict';

/* ════════════════════════════════════════
   대쉬보드 탭 & 랭킹 모듈
   ════════════════════════════════════════ */

var _activeRankingTab = 'neighborhood';
var _rankingCache = null;

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
    loadDistrictGeoJSON().then(function() {
      backfillDistrictCodes();
      loadRanking(_activeRankingTab);
    });
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

/* ─── 복합 점수 계산 ─── */
function calcCompositeScore(item) {
  var trashCount = Number(item.trash_count) || 0;
  var impact = Number(item.total_impact) || 0;
  return Math.round(trashCount * 10 + impact * 5);
}

/* ─── 랭킹 데이터 로드 & 렌더링 ─── */
async function loadRanking(rankType) {
  var content = document.getElementById('ranking-content');
  if (!content) return;

  // 로딩 표시
  content.innerHTML =
    '<div class="ranking-empty">' +
      '<div class="ranking-spinner"></div>' +
      '<div style="margin-top:12px;font-size:12px;color:var(--color-tertiary)">불러오는 중...</div>' +
    '</div>';

  // 데이터 로드 (캐시 활용)
  if (!_rankingCache) {
    var data = await loadRankingData('national');
    _rankingCache = data;
    AppState.rankingData = data;
  }

  var allUsers = _rankingCache;
  if (!allUsers || allUsers.length === 0) {
    content.innerHTML =
      '<div class="ranking-empty">' +
        '<div style="font-size:40px;margin-bottom:12px">🏆</div>' +
        '<div>아직 랭킹 데이터가 없습니다</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">플로깅을 시작해보세요!</div>' +
      '</div>';
    return;
  }

  // 점수 계산 & 정렬
  var scored = [];
  for (var i = 0; i < allUsers.length; i++) {
    var u = allUsers[i];
    scored.push({
      user_id: u.user_id,
      display_name: u.display_name || '익명',
      avatar_url: u.avatar_url || '',
      trash_count: Number(u.trash_count) || 0,
      total_impact: Number(u.total_impact) || 0,
      top_district: u.top_district || '',
      score: calcCompositeScore(u)
    });
  }
  scored.sort(function(a, b) { return b.score - a.score; });

  // 현재 유저의 최다 방문 시군구
  var myId = AppState.user ? AppState.user.id : null;
  var myDistrict = '';
  for (var m = 0; m < scored.length; m++) {
    if (scored[m].user_id === myId) {
      myDistrict = scored[m].top_district;
      break;
    }
  }

  // 서브탭별 필터링
  var filtered = scored;
  if (rankType === 'neighborhood') {
    if (myDistrict) {
      filtered = [];
      for (var n = 0; n < scored.length; n++) {
        if (scored[n].top_district === myDistrict) {
          filtered.push(scored[n]);
        }
      }
    }
  } else if (rankType === 'district') {
    // 시군구별로 그룹핑 → 각 시군구의 1등만 표시
    var districtBest = {};
    for (var d = 0; d < scored.length; d++) {
      var dc = scored[d].top_district;
      if (dc && !districtBest[dc]) {
        districtBest[dc] = scored[d];
      }
    }
    filtered = [];
    for (var key in districtBest) {
      filtered.push(districtBest[key]);
    }
    filtered.sort(function(a, b) { return b.score - a.score; });
  }

  // 랭킹 리스트 렌더링
  if (filtered.length === 0) {
    content.innerHTML =
      '<div class="ranking-empty">' +
        '<div style="font-size:40px;margin-bottom:12px">📍</div>' +
        '<div>내 동네 랭킹이 없습니다</div>' +
        '<div style="margin-top:8px;font-size:12px;color:var(--color-tertiary)">플로깅 기록이 쌓이면 동네 랭킹이 표시됩니다</div>' +
      '</div>';
    return;
  }

  var html = '<div class="ranking-list">';
  for (var r = 0; r < filtered.length; r++) {
    var user = filtered[r];
    var isSelf = user.user_id === myId;
    var pos = r + 1;
    var medal = '';
    if (pos === 1) medal = '🥇';
    else if (pos === 2) medal = '🥈';
    else if (pos === 3) medal = '🥉';

    var districtLabel = user.top_district ? getDistrictShortName(user.top_district) : '';
    var avatarHtml = user.avatar_url
      ? '<img src="' + user.avatar_url + '" alt="" class="ranking-avatar">'
      : '<div class="ranking-avatar ranking-avatar-default">👤</div>';

    html +=
      '<div class="ranking-item' + (isSelf ? ' ranking-item-self' : '') + '" onclick="openComparisonMap(\'' + user.user_id + '\', \'' + (user.display_name || '').replace(/'/g, "\\'") + '\')">' +
        '<div class="ranking-position">' + (medal || pos) + '</div>' +
        avatarHtml +
        '<div class="ranking-info">' +
          '<div class="ranking-name">' + user.display_name + (isSelf ? ' <span class="ranking-me-badge">나</span>' : '') + '</div>' +
          (districtLabel ? '<div class="ranking-district">' + districtLabel + '</div>' : '') +
        '</div>' +
        '<div class="ranking-score-col">' +
          '<div class="ranking-score">' + user.score.toLocaleString() + '</div>' +
          '<div class="ranking-sub-score">' + user.trash_count + '개 수거</div>' +
        '</div>' +
      '</div>';
  }
  html += '</div>';
  content.innerHTML = html;
}

/* ─── 랭킹 캐시 초기화 (새로고침 시) ─── */
function clearRankingCache() {
  _rankingCache = null;
  AppState.rankingData = null;
}
