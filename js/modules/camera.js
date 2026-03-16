'use strict';

/* ════════════════════════════════════════
   카메라 모듈
   ════════════════════════════════════════ */

/* ─── 카메라 초기화 ─── */
async function initCamera() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    var video = document.getElementById('camera-feed');
    if (video) {
      video.srcObject = stream;
      AppState.cameraStream = stream;
    }
  } catch (err) {
    console.error('카메라 초기화 실패:', err);
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
    }, 'image/jpeg', 0.85);
  });
}

/* ─── 촬영 플래시 효과 ─── */
function flashEffect() {
  var flash = document.getElementById('capture-flash');
  if (!flash) return;
  flash.classList.add('flash');
  setTimeout(function() { flash.classList.remove('flash'); }, 200);
}
