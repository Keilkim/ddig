'use strict';

/* ════════════════════════════════════════
   캘린더 모듈
   ════════════════════════════════════════ */

var _calYear = new Date().getFullYear();
var _calMonth = new Date().getMonth();
var _calActivity = {};

/* ─── 캘린더 렌더링 ─── */
async function renderCalendar() {
  // 월 라벨
  var label = document.getElementById('cal-month-label');
  if (label) label.textContent = _calYear + '년 ' + (_calMonth + 1) + '월';

  // 활동 데이터 로드
  _calActivity = await loadMonthlyActivity(_calYear, _calMonth);

  // 그리드 생성
  var grid = document.getElementById('calendar-grid');
  if (!grid) return;

  var firstDay = new Date(_calYear, _calMonth, 1).getDay();
  var daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  var today = new Date();

  var html = '';

  // 빈 칸 (이전 달)
  for (var e = 0; e < firstDay; e++) {
    html += '<div class="cal-day other-month"></div>';
  }

  // 날짜
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = _calYear + '-' +
      String(_calMonth + 1).padStart(2, '0') + '-' +
      String(d).padStart(2, '0');

    var isToday = (today.getFullYear() === _calYear &&
      today.getMonth() === _calMonth &&
      today.getDate() === d);

    var activity = _calActivity[dateStr];
    var classes = 'cal-day';
    if (isToday) classes += ' today';
    if (activity) classes += ' has-activity';

    html += '<div class="' + classes + '" onclick="selectCalendarDate(\'' + dateStr + '\')">';
    html += '<span>' + d + '</span>';
    if (activity) {
      html += '<span class="cal-day-count">' + activity.count + '개</span>';
    }
    html += '</div>';
  }

  grid.innerHTML = html;
}

/* ─── 이전달 ─── */
function calPrevMonth() {
  _calMonth--;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  renderCalendar();
}

/* ─── 다음달 ─── */
function calNextMonth() {
  _calMonth++;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  renderCalendar();
}

/* ─── 날짜 선택 → 대쉬보드 업데이트 ─── */
function selectCalendarDate(dateStr) {
  closeCalendar();
  var date = new Date(dateStr + 'T00:00:00');
  loadDashboard(date);
}
