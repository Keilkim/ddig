'use strict';

/* ════════════════════════════════════════
   사진 촬영 파이프라인
   촬영 → 위치 → 업로드 → Gemini 분석 → DB 저장
   ════════════════════════════════════════ */

var _isCapturing = false;

async function capturePhoto() {
  if (_isCapturing) return;
  _isCapturing = true;

  try {
    // 1. 플래시 효과
    flashEffect();

    // 2. 프레임 캡처
    var blob = await captureFrame();

    // 3. 위치 정보
    var loc = await getCurrentLocation();

    // 4. Storage 업로드
    var storagePath = await uploadPhoto(blob);

    // 5. DB에 메타데이터 저장 (분석 전)
    var photoMeta = await savePhotoMeta({
      storagePath: storagePath,
      latitude: loc.latitude,
      longitude: loc.longitude
    });

    // 6. 갤러리 즉시 업데이트
    await refreshGallery();

    // 7. Gemini 분석 (비동기 — 결과 후 업데이트)
    if (photoMeta && typeof analyzePhoto === 'function') {
      analyzeAndUpdate(blob, photoMeta.id);
    }

  } catch (err) {
    console.error('촬영 실패:', err);
  } finally {
    _isCapturing = false;
  }
}

/* ─── Gemini 분석 후 DB 업데이트 ─── */
async function analyzeAndUpdate(blob, photoId) {
  try {
    var base64 = await blobToBase64(blob);
    var analysis = await analyzePhoto(base64);
    if (!analysis) return;

    // 쓰레기가 아닌 경우 알림
    if (!analysis.is_trash) {
      showDetectionOverlay(blob, analysis.objects, false);
      showNotTrashToast(analysis.description);
      // DB에서 삭제 (쓰레기가 아니므로 저장 불필요)
      await deletePhoto(photoId);
      await refreshGallery();
      return;
    }

    // 쓰레기인 경우 — 바운딩박스 오버레이 표시 후 DB 업데이트
    showDetectionOverlay(blob, analysis.objects, true);
    await updatePhotoAnalysis(photoId, analysis);
    await refreshGallery();
  } catch (err) {
    console.error('Gemini 분석 실패:', err);
  }
}

/* ─── 쓰레기 아님 토스트 ─── */
function showNotTrashToast(description) {
  var existing = document.getElementById('not-trash-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'not-trash-toast';
  toast.className = 'not-trash-toast';
  toast.innerHTML = '<strong>🚫 쓰레기가 아닙니다</strong><br>' + (description || '쓰레기가 감지되지 않았습니다');
  document.body.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

/* ─── 바운딩박스 + Confidence 오버레이 ─── */
function showDetectionOverlay(blob, objects, isTrash) {
  if (!objects || objects.length === 0) return;

  var existing = document.getElementById('detection-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'detection-overlay';
  overlay.className = 'detection-overlay';

  var img = document.createElement('img');
  img.src = URL.createObjectURL(blob);

  var boxContainer = document.createElement('div');
  boxContainer.className = 'detection-box-container';

  img.onload = function() {
    var w = img.naturalWidth;
    var h = img.naturalHeight;

    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      if (!obj.bbox || obj.bbox.length < 4) continue;

      var box = document.createElement('div');
      box.className = 'detection-box' + (isTrash ? ' detection-box-trash' : ' detection-box-clean');
      box.style.left = (obj.bbox[0] / 10) + '%';
      box.style.top = (obj.bbox[1] / 10) + '%';
      box.style.width = ((obj.bbox[2] - obj.bbox[0]) / 10) + '%';
      box.style.height = ((obj.bbox[3] - obj.bbox[1]) / 10) + '%';

      var label = document.createElement('span');
      label.className = 'detection-label';
      var conf = Math.round((obj.confidence || 0) * 100);
      label.textContent = obj.label + ' ' + conf + '%';
      box.appendChild(label);

      boxContainer.appendChild(box);
    }
  };

  var closeBtn = document.createElement('button');
  closeBtn.className = 'detection-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function() {
    URL.revokeObjectURL(img.src);
    overlay.remove();
  };

  overlay.appendChild(img);
  overlay.appendChild(boxContainer);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // 5초 후 자동 닫기
  setTimeout(function() {
    if (document.getElementById('detection-overlay')) {
      URL.revokeObjectURL(img.src);
      overlay.remove();
    }
  }, 5000);
}

/* ─── Blob → Base64 변환 ─── */
function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      var base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ─── 갤러리 새로고침 ─── */
async function refreshGallery() {
  var photos = await loadUserPhotos();
  AppState.photos = photos;
  renderGallery(photos);
}

/* ─── 갤러리 렌더링 ─── */
function renderGallery(photos) {
  var scrollEl = document.getElementById('gallery-scroll');
  var emptyEl = document.getElementById('gallery-empty');
  if (!scrollEl) return;

  if (!photos || photos.length === 0) {
    scrollEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  var html = '';
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    var url = getPhotoUrl(p.storage_path);
    var label = p.trash_category || '';
    html +=
      '<div class="gallery-card">' +
        '<img src="' + url + '" alt="사진" loading="lazy">' +
        (label ? '<div class="gallery-card-label">' + label + '</div>' : '') +
        '<button class="gallery-card-delete" onclick="onDeletePhoto(\'' + p.id + '\')">&times;</button>' +
      '</div>';
  }
  scrollEl.innerHTML = html;
}

/* ─── 사진 삭제 핸들러 ─── */
async function onDeletePhoto(photoId) {
  if (!confirm('이 사진을 삭제할까요?')) return;
  await deletePhoto(photoId);
  await refreshGallery();
}
