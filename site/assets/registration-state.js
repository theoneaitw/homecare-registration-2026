export const PREPARING_MESSAGE = '報名系統準備中，請稍後再試或聯絡窗口';
export const SESSION_IDS = ['tainan-2026-12-11', 'taichung-2026-12-15'];
export function validateRegistration(values) {
  const errors = {};
  if (!SESSION_IDS.includes(values.session_id)) errors.session_id = '請選擇欲參加的場次。';
  if (!values.name.trim() || values.name.trim().length > 80) errors.name = '請填寫姓名（80 字以內）。';
  const age = Number(values.age);
  if (!String(values.age).trim() || !Number.isInteger(age) || age < 0 || age > 120) errors.age = '請填寫有效的整數年齡。';
  else if (age < 18) errors.age = '未滿 18 歲，請先聯繫活動窗口協助報名，不需在此提交個人資料。';
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
