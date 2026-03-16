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
    if (analysis) {
      await updatePhotoAnalysis(photoId, analysis);
      await refreshGallery();
    }
  } catch (err) {
    console.error('Gemini 분석 실패:', err);
  }
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
