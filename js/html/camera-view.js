'use strict';

var _HTML_CAMERA_VIEW = '' +
  '<div class="camera-container">' +
    '<video id="camera-feed" autoplay playsinline muted></video>' +
    '<canvas id="camera-canvas" class="hidden"></canvas>' +

    /* 상단 카메라 컨트롤 바 */
    '<div class="camera-top-bar">' +
      '<button class="camera-ctrl-btn" id="btn-flash" onclick="toggleFlash()">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' +
        '<span class="camera-ctrl-label" id="flash-label">OFF</span>' +
      '</button>' +
      '<div class="camera-zoom-ctrl">' +
        '<button class="camera-zoom-btn" onclick="cameraZoomOut()">-</button>' +
        '<span class="camera-zoom-level" id="camera-zoom-level">1.0x</span>' +
        '<button class="camera-zoom-btn" onclick="cameraZoomIn()">+</button>' +
      '</div>' +
      '<button class="camera-ctrl-btn" onclick="toggleCameraFacing()">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
        '<span class="camera-ctrl-label">전환</span>' +
      '</button>' +
    '</div>' +

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
