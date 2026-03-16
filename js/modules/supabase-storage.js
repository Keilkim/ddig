'use strict';

/* ════════════════════════════════════════
   Supabase Storage 모듈
   ════════════════════════════════════════ */

/* ─── 사진 업로드 ─── */
async function uploadPhoto(blob) {
  if (!supabaseClient || !AppState.user) throw new Error('인증 필요');

  var userId = AppState.user.id;
  var timestamp = Date.now();
  var path = userId + '/' + timestamp + '.jpg';

  var result = await supabaseClient.storage
    .from('photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (result.error) throw result.error;
  return path;
}

/* ─── 사진 URL 가져오기 ─── */
function getPhotoUrl(storagePath) {
  if (!supabaseClient) return '';
  var result = supabaseClient.storage
    .from('photos')
    .getPublicUrl(storagePath);
  return result.data.publicUrl;
}

/* ─── 사진 삭제 (Storage) ─── */
async function deletePhotoFile(storagePath) {
  if (!supabaseClient) return;
  await supabaseClient.storage
    .from('photos')
    .remove([storagePath]);
}
