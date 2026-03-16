'use strict';

var _HTML_PERMISSION_POPUP = '' +
  '<div id="permission-popup" class="popup-overlay">' +
    '<div class="popup-content permission-popup-box">' +
      '<div class="permission-title">DIGG</div>' +
      '<div class="permission-subtitle">&times; GONGSIM</div>' +
      '<p class="permission-message">' +
        '본 앱을 활성화하기 위해서는<br>사용자의 <strong>위치</strong>와 <strong>카메라</strong> 기능을 요구합니다' +
      '</p>' +
      '<div class="permission-buttons">' +
        '<button class="btn-reject" onclick="rejectPermission()">거절</button>' +
        '<button class="btn-approve" onclick="approvePermission()">승인</button>' +
      '</div>' +
    '</div>' +
  '</div>';
