'use strict';

/* ════════════════════════════════════════
   사진 촬영 파이프라인
   촬영 → Gemini 분석 → 확인 모달 → 저장
   ════════════════════════════════════════ */

var _isCapturing = false;

/* ─── 임시 데이터 (모달 확인 전) ─── */
var _pendingCapture = null;

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

    // 4. Gemini 분석 (저장 전에 먼저!)
    showAnalyzingOverlay();
    var base64 = await blobToBase64(blob);
    var analysis = await analyzePhoto(base64);
    hideAnalyzingOverlay();

    if (!analysis) {
      // API 실패 시 기본 저장 플로우
      _pendingCapture = { blob: blob, loc: loc, analysis: null };
      showConfirmModal(blob, null);
      return;
    }

    // 5. 쓰레기 여부에 따라 모달 표시
    _pendingCapture = { blob: blob, loc: loc, analysis: analysis };

    if (!analysis.is_trash) {
      // 쓰레기가 아님 → 알림 모달
      showNotTrashModal(blob, analysis);
    } else {
      // 쓰레기 → 확인 모달 (바운딩박스 + 컨피던스)
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
      '<div class="analyzing-icon">🔍</div>' +
      '<p class="analyzing-text">AI가 분석하고 있어요...</p>' +
      '<p class="analyzing-sub">잠깐만 기다려주세요!</p>' +
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
        '<span class="detection-modal-emoji">🌿</span>' +
        '<h3 class="detection-modal-title">쓰레기가 아니에요!</h3>' +
      '</div>' +
      '<div class="detection-modal-img-wrap">' +
        '<img src="' + imgUrl + '" class="detection-modal-img" />' +
        '<div class="detection-badge not-trash-badge">CLEAN ✨</div>' +
      '</div>' +
      '<p class="detection-modal-desc">' + (analysis.description || '쓰레기가 감지되지 않았습니다') + '</p>' +
      buildObjectsList(analysis.objects, false) +
      '<div class="detection-modal-actions">' +
        '<button class="detection-btn detection-btn-close" onclick="closeDetectionModal()">확인</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function() { modal.classList.add('show'); }, 10);
}

/* ─── 쓰레기 확인 모달 (바운딩박스 + 컨피던스) ─── */
function showConfirmModal(blob, analysis) {
  var existing = document.getElementById('detection-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'detection-modal';
  modal.className = 'detection-modal';

  var imgUrl = URL.createObjectURL(blob);
  var categoryEmoji = getCategoryEmoji(analysis ? analysis.trash_category : 'other');
  var categoryLabel = getCategoryLabel(analysis ? analysis.trash_category : 'other');
  var impact = analysis ? analysis.pollution_impact : 0;

  modal.innerHTML =
    '<div class="detection-modal-card trash-card">' +
      '<div class="detection-modal-header">' +
        '<span class="detection-modal-emoji">🗑️</span>' +
        '<h3 class="detection-modal-title">쓰레기 발견!</h3>' +
      '</div>' +
      '<div class="detection-modal-img-wrap" id="detection-img-wrap">' +
        '<img src="' + imgUrl + '" class="detection-modal-img" id="detection-img" />' +
        '<div class="detection-bbox-container" id="detection-bbox-container"></div>' +
        '<div class="detection-badge trash-badge">' + categoryEmoji + ' ' + categoryLabel + '</div>' +
      '</div>' +
      (analysis ? '<p class="detection-modal-desc">' + (analysis.description || '') + '</p>' : '') +
      buildObjectsList(analysis ? analysis.objects : [], true) +
      (analysis ? buildImpactBar(impact) : '') +
      '<div class="detection-modal-actions">' +
        '<button class="detection-btn detection-btn-cancel" onclick="cancelCapture()">취소</button>' +
        '<button class="detection-btn detection-btn-save" onclick="confirmCapture()">저장하기 📸</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // 바운딩박스 렌더링
  if (analysis && analysis.objects && analysis.objects.length > 0) {
    var img = document.getElementById('detection-img');
    if (img) {
      img.onload = function() {
        renderBoundingBoxes(analysis.objects);
      };
      if (img.complete) renderBoundingBoxes(analysis.objects);
    }
  }

  setTimeout(function() { modal.classList.add('show'); }, 10);
}

/* ─── 바운딩박스 렌더링 ─── */
function renderBoundingBoxes(objects) {
  var container = document.getElementById('detection-bbox-container');
  if (!container) return;
  container.innerHTML = '';

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    if (!obj.bbox || obj.bbox.length < 4) continue;

    var box = document.createElement('div');
    box.className = 'detection-bbox';
    box.style.left = (obj.bbox[0] / 10) + '%';
    box.style.top = (obj.bbox[1] / 10) + '%';
    box.style.width = ((obj.bbox[2] - obj.bbox[0]) / 10) + '%';
    box.style.height = ((obj.bbox[3] - obj.bbox[1]) / 10) + '%';

    var conf = Math.round((obj.confidence || 0) * 100);
    var label = document.createElement('span');
    label.className = 'detection-bbox-label';
    label.textContent = obj.label + ' ' + conf + '%';
    box.appendChild(label);

    container.appendChild(box);
  }
}

/* ─── 오브젝트 리스트 빌드 ─── */
function buildObjectsList(objects, isTrash) {
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

/* ─── 오염 영향도 바 ─── */
function buildImpactBar(impact) {
  var pct = Math.min(impact * 10, 100);
  var impactClass = impact >= 7 ? 'impact-high' : impact >= 4 ? 'impact-mid' : 'impact-low';
  return '' +
    '<div class="detection-impact">' +
      '<span class="detection-impact-label">오염 영향도</span>' +
      '<div class="detection-impact-bar">' +
        '<div class="detection-impact-fill ' + impactClass + '" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<span class="detection-impact-num">' + impact + '/10</span>' +
    '</div>';
}

/* ─── 카테고리 이모지/라벨 ─── */
function getCategoryEmoji(cat) {
  var map = {
    plastic: '🧴', paper: '📄', glass: '🫙', metal: '🥫',
    organic: '🍂', cigarette: '🚬', other: '🗑️', none: '✨'
  };
  return map[cat] || '🗑️';
}

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
    setTimeout(function() { modal.remove(); }, 300);
  }
  _pendingCapture = null;
}

/* ─── 취소 ─── */
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
    // 1. Storage 업로드
    var storagePath = await uploadPhoto(data.blob);

    // 2. DB에 메타데이터 저장
    var photoMeta = await savePhotoMeta({
      storagePath: storagePath,
      latitude: data.loc.latitude,
      longitude: data.loc.longitude
    });

    // 3. 분석 결과 업데이트
    if (photoMeta && data.analysis) {
      await updatePhotoAnalysis(photoMeta.id, data.analysis);
    }

    // 4. 갤러리 새로고침
    await refreshGallery();

    // 5. 모달 닫기
    closeDetectionModal();

  } catch (err) {
    console.error('저장 실패:', err);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '다시 시도 📸';
    }
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
    var emoji = getCategoryEmoji(label);
    html +=
      '<div class="gallery-card">' +
        '<img src="' + url + '" alt="사진" loading="lazy">' +
        (label ? '<div class="gallery-card-label">' + emoji + ' ' + getCategoryLabel(label) + '</div>' : '') +
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
