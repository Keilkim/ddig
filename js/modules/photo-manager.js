'use strict';

/* ════════════════════════════════════════
   사진 촬영 파이프라인
   촬영 → Gemini 분석 → 확인 모달 → 저장
   ════════════════════════════════════════ */

var _isCapturing = false;
var _pendingCapture = null;

var _CATEGORY_OPTIONS = [
  { value: 'plastic', label: '플라스틱' },
  { value: 'vinyl', label: '비닐류' },
  { value: 'styrofoam', label: '스티로폼' },
  { value: 'paper', label: '종이류' },
  { value: 'paperpack', label: '종이팩' },
  { value: 'glass', label: '유리류' },
  { value: 'can', label: '캔류' },
  { value: 'cigarette', label: '담배꽁초' },
  { value: 'other', label: '기타' }
];

async function capturePhoto() {
  if (_isCapturing || !AppState.cameraActive) return;
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
      (analysis ? buildCategorySelect(analysis.trash_category) : '') +
      buildObjectsList(analysis ? analysis.objects : []) +
      '<div class="detection-modal-actions">' +
        '<button class="detection-btn detection-btn-cancel" onclick="cancelCapture()">취소</button>' +
        '<button class="detection-btn detection-btn-save" onclick="confirmCapture()">저장하기</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  setTimeout(function() { modal.classList.add('show'); }, 10);

  // 바운딩박스 렌더링 — 이미지 로드 완료 후 정확한 크기 측정
  if (analysis && analysis.objects && analysis.objects.length > 0) {
    var img = document.getElementById('detection-img');
    if (img) {
      var doBboxRender = function() {
        // requestAnimationFrame으로 레이아웃 완료 후 렌더링
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            renderBoundingBoxes(analysis.objects);
          });
        });
      };
      if (img.complete && img.naturalWidth > 0) {
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

  // getBoundingClientRect로 정확한 렌더링 크기 측정
  var imgRect = img.getBoundingClientRect();
  var natW = img.naturalWidth || 1;
  var natH = img.naturalHeight || 1;

  // object-fit: contain에서 실제 이미지 표시 영역
  var scale = Math.min(imgRect.width / natW, imgRect.height / natH);
  var dispW = natW * scale;
  var dispH = natH * scale;
  var offsetX = (imgRect.width - dispW) / 2;
  var offsetY = (imgRect.height - dispH) / 2;

  container.style.left = offsetX + 'px';
  container.style.top = offsetY + 'px';
  container.style.width = dispW + 'px';
  container.style.height = dispH + 'px';

  console.log('[bbox 렌더링] img:', imgRect.width, 'x', imgRect.height,
    'disp:', dispW, 'x', dispH, 'offset:', offsetX, offsetY);

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    if (!obj.bbox || obj.bbox.length < 4) continue;

    // bbox 유효성 검사 — [0,0,0,0] 같은 무의미한 좌표 필터링
    var x1 = obj.bbox[0] / 1000;
    var y1 = obj.bbox[1] / 1000;
    var x2 = obj.bbox[2] / 1000;
    var y2 = obj.bbox[3] / 1000;

    if (x2 - x1 < 0.01 || y2 - y1 < 0.01) continue;

    console.log('[bbox]', obj.label, 'raw:', obj.bbox, '→ norm:', x1, y1, x2, y2);

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

/* ─── 카테고리 선택 콤보박스 ─── */
function buildCategorySelect(selectedCategory) {
  var html = '<div class="detection-category-select-wrap">' +
    '<label class="detection-category-label">분류 카테고리</label>' +
    '<select id="detection-category-select" class="detection-category-select" onchange="onCategoryChange(this.value)">';
  for (var i = 0; i < _CATEGORY_OPTIONS.length; i++) {
    var opt = _CATEGORY_OPTIONS[i];
    var sel = (opt.value === selectedCategory) ? ' selected' : '';
    html += '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
  }
  html += '</select></div>';
  return html;
}

function onCategoryChange(newCategory) {
  if (_pendingCapture && _pendingCapture.analysis) {
    _pendingCapture.analysis.trash_category = newCategory;
  }
  var badge = document.querySelector('.detection-badge.trash-badge');
  if (badge) {
    badge.textContent = getCategoryLabel(newCategory);
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

/* ─── 카테고리 라벨 (환경부 분류 기준) ─── */
function getCategoryLabel(cat) {
  var map = {
    plastic: '플라스틱', vinyl: '비닐류', styrofoam: '스티로폼',
    paper: '종이류', paperpack: '종이팩', glass: '유리류',
    can: '캔류', cigarette: '담배꽁초', other: '기타',
    metal: '캔류', organic: '기타', none: '없음'
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
      if (AppState.cameraActive) ensureCameraPlaying();
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

/* ─── 갤러리 새로고침 (당일 사진만) ─── */
async function refreshGallery() {
  var todayPhotos = await loadPhotosByDate(new Date());
  renderGallery(todayPhotos);
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
