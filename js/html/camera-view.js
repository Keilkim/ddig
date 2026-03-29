'use strict';

var _HTML_CAMERA_VIEW = '' +
  '<div class="camera-container">' +
    '<video id="camera-feed" autoplay playsinline muted></video>' +
    '<canvas id="camera-canvas" class="hidden"></canvas>' +
    '<div class="camera-guide-overlay">' +
      '<div class="camera-guide-box"></div>' +
      '<p class="camera-guide-text">쓰레기를 사각형 안에 맞춰주세요</p>' +
    '</div>' +
    '<div id="camera-placeholder" class="camera-placeholder">' +
      '<div class="camera-placeholder-content">' +
        '<div class="camera-placeholder-icon">📷</div>' +
        '<p class="camera-placeholder-text">카메라를 시작하려면<br>아래 버튼을 눌러주세요</p>' +
        '<button class="camera-placeholder-btn" onclick="startCameraManual()">카메라 시작</button>' +
      '</div>' +
    '</div>' +
    '<div id="capture-flash" class="capture-flash"></div>' +
    '<button class="btn-capture-float" onclick="capturePhoto()"></button>' +
  '</div>';
