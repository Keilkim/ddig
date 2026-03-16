'use strict';

var _FILTER_OPTIONS = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1달' },
  { key: '3m', label: '3달' },
  { key: '6m', label: '6달' },
  { key: '1y', label: '1년' },
  { key: '3y', label: '3년' },
  { key: '5y', label: '5년' }
];

var _HTML_FILTER_BAR = (function() {
  var buttons = '';
  for (var i = 0; i < _FILTER_OPTIONS.length; i++) {
    var opt = _FILTER_OPTIONS[i];
    var activeClass = opt.key === '1m' ? ' filter-active' : '';
    buttons += '<button class="filter-btn' + activeClass + '" data-period="' + opt.key + '" onclick="setFilter(\'' + opt.key + '\')">' + opt.label + '</button>';
  }
  return '<div class="filter-bar">' + buttons + '</div>';
})();
