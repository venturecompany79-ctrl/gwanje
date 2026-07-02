-- =============================================================
-- 문서 스토리지 MIME 허용목록 강화
-- application/octet-stream을 제거해 브라우저/클라이언트가 임의 파일을
-- 일반 바이너리로 우회 업로드하지 못하게 한다.
-- =============================================================

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx'
]
where id = 'company-documents';
