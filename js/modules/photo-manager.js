'use strict';

/* ════════════════════════════════════════
   사진 촬영 파이프라인
   촬영 → Gemini 분석 → 확인 모달 → 저장
   ════════════════════════════════════════ */

var _isCapturing = false;
var _pendingCapture = null;

async function capturePhoto() {
  if (_isCapturing) return;
  _isCapturing = true;

  try {
    flashEffect();
    var blob = await captureFrame();
    var loc = await getCurrentLocation();

    showAnalyzingOverlay();
    var base64 = await blobToBase64(blob);
    var analysis = await analyzePhoto(base64);
    hideAnalyzingOverlay();

    if (!analysis) {
      _pendingCapture = { blob: blob, loc: loc, analysis: null };
      showConfirmModal(blob, null);
      return;
    }

    _pendingCapture = { blob: blob, loc: loc, analysis: analysis };

    if (!analysis.is_trash) {
      showNotTrashModal(blob, analysis);
    } else {
      showConfirmModal(blob, analysis);
    }

  } catch (err) {
    console.error('촬영 실패:', err);
    hideAnalyzingOverlay();
  } finally {
    _isCapturing = false;
  }
}

/* ─── 분석 중 오버레이 ─── */
function showAnalyzingOverlay() {
  var existing = document.getElementById('analyzing-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'analyzing-overlay';
  overlay.className = 'analyzing-overlay';
  overlay.innerHTML =
    '<div class="analyzing-content">' +
      '<div class="analyzing-spinner"></div>' +
      '<p class="analyzing-text">AI 분석 중</p>' +
      '<p class="analyzing-sub">잠시만 기다려주세요</p>' +
    '</div>';
  document.body.appendChild(overlay);
}

function hideAnalyzingOverlay() {
  var el = document.getElementById('analyzing-overlay');
  if (el) el.remove();
}

/* ─── 쓰레기 아님 모달 ─── */
function showNotTrashModal(blob, analysis) {
  var existing = document.getElementById('detection-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'detection-modal';
  modal.className = 'detection-modal';

  var imgUrl = URL.createObjectURL(blob);

  modal.innerHTML =
    '<div class="detection-modal-card not-trash-card">' +
      '<div class="detection-modal-header">' +
        '<h3 class="detection-modal-title">쓰레기가 아닙니다</h3>' +
      '</div>' +
      '<div class="detection-modal-img-wrap">' +
        '<img src="' + imgUrl + '" class="detection-modal-img" />' +
        '<div class="detection-badge not-trash-badge">CLEAN</div>' +
      '</div>' +
      '<p class="detection-modal-desc">' + (analysis.description || '쓰레기가 감지되지 않았습니다') + '</p>' +
      '<div class="detection-modal-actions">' +
        '<button class="detection-btn detection-btn-close" onclick="closeDetectionModal()">확인</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function() { modal.classList.add('show'); }, 10);
}

/* ─── 쓰레기 확인 모달 ─── */
function showConfirmModal(blob, analysis) {
  var existing = document.getElementById('detection-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'detection-modal';
  modal.className = 'detection-modal';

  var imgUrl = URL.createObjectURL(blob);
  var categoryLabel = getCategoryLabel(analysis ? analysis.trash_category : 'other');

  modal.innerHTML =
    '<div class="detection-modal-card trash-card">' +
      '<div class="detection-modal-header">' +
        '<h3 class="detection-modal-title">쓰레기 발견</h3>' +
      '</div>' +
      '<div class="detection-modal-img-wrap" id="detection-img-wrap">' +
        '<img src="' + imgUrl + '" class="detection-modal-img" id="detection-img" />' +
        '<div class="detection-bbox-container" id="detection-bbox-container"></div>' +
        '<div class="detection-badge trash-badge">' + categoryLabel + '</div>' +
      '</div>' +
      (analysis ? '<p class="detection-modal-desc">' + (analysis.description || '') + '</p>' : '') +
      buildObjectsList(analysis ? analysis.objects : []) +
      '<div class="detection-modal-actions">' +
        '<button class="detection-btn detection-btn-cancel" onclick="cancelCapture()">취소</button>' +
        '<button class="detection-btn detection-btn-save" onclick="confirmCapture()">저장하기</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function() { modal.classList.add('show'); }, 10);

  // 바운딩박스 렌더링
  if (analysis && analysis.objects && analysis.objects.length > 0) {
    var img = document.getElementById('detection-img');
    if (img) {
      var doBboxRender = function() {
        setTimeout(function() {
          renderBoundingBoxes(analysis.objects);
        }, 400);
      };
      if (img.complete) {
        doBboxRender();
      } else {
        img.onload = doBboxRender;
      }
    }
  }
}

/* ─── 바운딩박스 렌더링 ─── */
function renderBoundingBoxes(objects) {
  var container = document.getElementById('detection-bbox-container');
  var img = document.getElementById('detection-img');
  if (!container || !img) return;
  container.innerHTML = '';

  var wrap = img.parentElement;
  var wrapW = wrap.offsetWidth;
  var wrapH = wrap.offsetHeight;
  var natW = img.naturalWidth || 1;
  var natH = img.naturalHeight || 1;

  var scale = Math.min(wrapW / natW, wrapH / natH);
  var dispW = natW * scale;
  var dispH = natH * scale;
  var offsetX = (wrapW - dispW) / 2;
  var offsetY = (wrapH - dispH) / 2;

  container.style.left = offsetX + 'px';
  container.style.top = offsetY + 'px';
  container.style.width = dispW + 'px';
  container.style.height = dispH + 'px';

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    if (!obj.bbox || obj.bbox.length < 4) continue;

    var x1 = obj.bbox[0] / 1000;
    var y1 = obj.bbox[1] / 1000;
    var x2 = obj.bbox[2] / 1000;
    var y2 = obj.bbox[3] / 1000;

    var box = document.createElement('div');
    box.className = 'detection-bbox';
    box.style.left = (x1 * 100) + '%';
    box.style.top = (y1 * 100) + '%';
    box.style.width = ((x2 - x1) * 100) + '%';
    box.style.height = ((y2 - y1) * 100) + '%';

    var conf = Math.round((obj.confidence || 0) * 100);
    var label = document.createElement('span');
    label.className = 'detection-bbox-label';
    label.textContent = obj.label + ' ' + conf + '%';
    box.appendChild(label);

    container.appendChild(box);
  }
}

/* ─── 오브젝트 리스트 ─── */
function buildObjectsList(objects) {
  if (!objects || objects.length === 0) return '';

  var html = '<div class="detection-objects-list">';
  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    var conf = Math.round((obj.confidence || 0) * 100);
    var confClass = conf >= 80 ? 'conf-high' : conf >= 50 ? 'conf-mid' : 'conf-low';
    html +=
      '<div class="detection-object-item">' +
        '<span class="detection-object-name">' + (obj.label || '알 수 없음') + '</span>' +
        '<div class="detection-conf-bar">' +
          '<div class="detection-conf-fill ' + confClass + '" style="width:' + conf + '%"></div>' +
        '</div>' +
        '<span class="detection-conf-num">' + conf + '%</span>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

/* ─── 카테고리 라벨 (이모지 없음) ─── */
function getCategoryLabel(cat) {
  var map = {
    plastic: '플라스틱', paper: '종이', glass: '유리', metal: '금속',
    organic: '유기물', cigarette: '담배꽁초', other: '기타', none: '없음'
  };
  return map[cat] || '기타';
}

/* ─── 모달 닫기 ─── */
function closeDetectionModal() {
  var modal = document.getElementById('detection-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(function() {
      modal.remove();
      ensureCameraPlaying();
    }, 300);
  }
  _pendingCapture = null;
}

function cancelCapture() {
  closeDetectionModal();
}

/* ─── 저장 확인 ─── */
async function confirmCapture() {
  if (!_pendingCapture) return;

  var data = _pendingCapture;
  var saveBtn = document.querySelector('.detection-btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }

  try {
    var storagePath = await uploadPhoto(data.blob);
    var photoMeta = await savePhotoMeta({
      storagePath: storagePath,
      latitude: data.loc.latitude,
      longitude: data.loc.longitude
    });

    if (photoMeta && data.analysis) {
      await updatePhotoAnalysis(photoMeta.id, data.analysis);
    }

    await refreshGallery();
    closeDetectionModal();

  } catch (err) {
    console.error('저장 실패:', err);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '다시 시도';
    }
  }
}

/* ─── Blob → Base64 ─── */
function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result.split(',')[1]);
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

/* ─── 갤러리 렌더링 (클릭으로 삭제) ─── */
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
      '<div class="gallery-card" onclick="onGalleryCardTap(\'' + p.id + '\')">' +
        '<img src="' + url + '" alt="사진" loading="lazy">' +
        (label ? '<div class="gallery-card-label">' + getCategoryLabel(label) + '</div>' : '') +
      '</div>';
  }
  scrollEl.innerHTML = html;
}

/* ─── 갤러리 카드 탭 → 삭제 확인 ─── */
async function onGalleryCardTap(photoId) {
  if (confirm('이 사진을 삭제할까요?')) {
    await deletePhoto(photoId);
    await refreshGallery();
  }
}
