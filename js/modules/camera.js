'use strict';

/* ════════════════════════════════════════
   카메라 모듈
   ════════════════════════════════════════ */

var _cameraFacing = 'environment';
var _cameraZoom = 1.0;
var _flashOn = false;

/* ─── 카메라 초기화 ─── */
async function initCamera() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: _cameraFacing,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    var video = document.getElementById('camera-feed');
    if (video) {
      video.srcObject = stream;
      video.play().catch(function() {});
      AppState.cameraStream = stream;
    }

    // 줌 리셋
    _cameraZoom = 1.0;
    _updateZoomLabel();
  } catch (err) {
    console.error('카메라 초기화 실패:', err);
    throw err;
  }
}

/* ─── 카메라 재생 보장 (모달/뷰 전환 후 복구) ─── */
function ensureCameraPlaying() {
  var video = document.getElementById('camera-feed');
  if (!video || !AppState.cameraActive) return;

  if (AppState.cameraStream) {
    // 스트림 트랙이 살아있는지 확인
    var tracks = AppState.cameraStream.getVideoTracks();
    if (tracks.length === 0 || tracks[0].readyState === 'ended') {
      // 트랙이 죽었으면 재초기화
      AppState.cameraStream = null;
      initCamera();
      return;
    }
    // srcObject 재설정
    if (!video.srcObject || video.srcObject !== AppState.cameraStream) {
      video.srcObject = AppState.cameraStream;
    }
    // 재생
    if (video.paused || video.ended) {
      video.play().catch(function() {});
    }
  } else {
    initCamera();
  }
}

/* ─── 카메라 정지 ─── */
function stopCamera() {
  if (AppState.cameraStream) {
    var tracks = AppState.cameraStream.getTracks();
    for (var i = 0; i < tracks.length; i++) {
      tracks[i].stop();
    }
    AppState.cameraStream = null;
  }
}

/* ─── 사진 캡처 → Blob 반환 ─── */
function captureFrame() {
  return new Promise(function(resolve, reject) {
    var video = document.getElementById('camera-feed');
    var canvas = document.getElementById('camera-canvas');
    if (!video || !canvas) return reject(new Error('카메라 요소 없음'));

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(function(blob) {
      if (blob) resolve(blob);
      else reject(new Error('캡처 실패'));
    }, 'image/jpeg', 0.6);
  });
}

/* ─── 카메라 수동 시작 ─── */
function startCameraManual() {
  initCamera().then(function() {
    var placeholder = document.getElementById('camera-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    AppState.cameraActive = true;
  }).catch(function(err) {
    console.error('카메라 시작 실패:', err);
    alert('카메라를 시작할 수 없습니다.\n설정에서 카메라 권한을 허용해주세요.');
  });
}

/* ─── 촬영 플래시 효과 ─── */
function flashEffect() {
  var flash = document.getElementById('capture-flash');
  if (!flash) return;
  flash.classList.add('flash');
  setTimeout(function() { flash.classList.remove('flash'); }, 200);
}

/* ─── 플래시(토치) 토글 ─── */
function toggleFlash() {
  if (!AppState.cameraStream) return;

  var track = AppState.cameraStream.getVideoTracks()[0];
  if (!track) return;

  var caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps.torch) return;

  _flashOn = !_flashOn;
  track.applyConstraints({ advanced: [{ torch: _flashOn }] }).catch(function() {
    _flashOn = false;
  });

  var label = document.getElementById('flash-label');
  var btn = document.getElementById('btn-flash');
  if (label) label.textContent = _flashOn ? 'ON' : 'OFF';
  if (btn) btn.classList.toggle('camera-ctrl-btn-active', _flashOn);
}

/* ─── 카메라 줌 ─── */
function _applyZoom() {
  if (!AppState.cameraStream) return;

  var track = AppState.cameraStream.getVideoTracks()[0];
  if (!track) return;

  var caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps.zoom) return;

  var min = caps.zoom.min || 1;
  var max = caps.zoom.max || 1;
  var clamped = Math.max(min, Math.min(max, _cameraZoom));
  _cameraZoom = clamped;

  track.applyConstraints({ advanced: [{ zoom: clamped }] }).catch(function() {});
  _updateZoomLabel();
}

function _updateZoomLabel() {
  var el = document.getElementById('camera-zoom-level');
  if (el) el.textContent = _cameraZoom.toFixed(1) + 'x';
}

function cameraZoomIn() {
  _cameraZoom = Math.min(_cameraZoom + 0.5, 10);
  _applyZoom();
}

function cameraZoomOut() {
  _cameraZoom = Math.max(_cameraZoom - 0.5, 1);
  _applyZoom();
}

/* ─── 전/후면 카메라 전환 ─── */
async function toggleCameraFacing() {
  _cameraFacing = (_cameraFacing === 'environment') ? 'user' : 'environment';
  _flashOn = false;

  var label = document.getElementById('flash-label');
  var btn = document.getElementById('btn-flash');
  if (label) label.textContent = 'OFF';
  if (btn) btn.classList.remove('camera-ctrl-btn-active');

  stopCamera();
  try {
    await initCamera();
    var placeholder = document.getElementById('camera-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    AppState.cameraActive = true;
  } catch (err) {
    console.error('카메라 전환 실패:', err);
  }
}
