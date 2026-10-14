export const PREPARING_MESSAGE = '報名系統準備中，請稍後再試或聯絡窗口';
export const SESSION_IDS = ['tainan-2026-12-11', 'taichung-2026-12-15'];
export const AGE_BANDS = ['18-22','23-27','28-32','33-37','38-42','43-47','48-52','53-57','58-62','63-67','68-72','73-77','78-82','83+'];
export function validateRegistration(values) {
  const errors = {};
  if (!SESSION_IDS.includes(values.session_id)) errors.session_id = '請選擇欲參加的場次。';
  if (!values.name.trim() || values.name.trim().length > 80) errors.name = '請填寫姓名（80 字以內）。';
  if (!AGE_BANDS.includes(values.age_band)) errors.age_band = '請選擇有效的年齡區間。';
  if (!values.organization.trim() || values.organization.trim().length > 150) errors.organization = '請填寫服務單位；無服務單位可填「無」。';
  if (!['護理', '照服', '其他醫療人員', '其他'].includes(values.profession)) errors.profession = '請選擇職類。';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.length > 254) errors.email = '請填寫有效的電子郵件地址。';
  if (!/^[+\d\s()#-]{8,30}$/.test(values.phone.trim())) errors.phone = '請填寫可聯絡的電話，可包含區碼與分機。';
  if (!values.consent) errors.consent = '請閱讀並同意個人資料蒐集告知事項。';
  return errors;
}
export function confirmedReceipt(response) {
  if (!response || typeof response !== 'object') return null;
  return response.status === 'succeeded' && typeof response.receipt === 'string' && /^[a-zA-Z0-9_-]{6,120}$/.test(response.receipt) ? response.receipt : null;
}
export function safeApiBase(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return '';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}
export function submissionAttempt(previous, payload, newId) {
  const signature = JSON.stringify(payload);
  return previous.signature === signature ? previous : { signature, id: newId() };
}
