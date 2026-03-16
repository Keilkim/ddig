'use strict';

var _HTML_CALENDAR_POPUP = '' +
  '<div id="calendar-popup" class="popup-overlay">' +
    '<div class="popup-content calendar-popup-box">' +
      '<div class="calendar-header">' +
        '<button class="cal-nav-btn" onclick="calPrevMonth()">&lsaquo;</button>' +
        '<span id="cal-month-label" class="cal-month-label"></span>' +
        '<button class="cal-nav-btn" onclick="calNextMonth()">&rsaquo;</button>' +
      '</div>' +
      '<div class="calendar-weekdays">' +
        '<span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>' +
      '</div>' +
      '<div id="calendar-grid" class="calendar-grid">' +
        '<!-- 날짜 셀 동적 생성 -->' +
      '</div>' +
      '<div id="calendar-legend" class="calendar-legend">' +
        '<span class="legend-item"><span class="legend-dot active-dot"></span> 플로깅 활동일</span>' +
      '</div>' +
      '<button class="cal-close-btn" onclick="closeCalendar()">닫기</button>' +
    '</div>' +
  '</div>';
