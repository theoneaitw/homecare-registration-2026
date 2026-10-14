import { PREPARING_MESSAGE, SESSION_IDS, validateRegistration, confirmedReceipt, safeApiBase, submissionAttempt } from './registration-state.js';

const apiBase = safeApiBase(window.HOMECARE_CONFIG?.apiBase);
const form = document.getElementById('registration-form');
const fields = document.getElementById('registration-fields');
const formAlert = document.getElementById('form-alert');
const submitLabel = document.getElementById('submit-label');
const systemNotice = document.getElementById('system-notice');
const submitButton = form.querySelector('button[type="submit"]');
let registrationReady = false;
function setRegistrationReady(ready) {
  registrationReady = ready === true;
  submitButton.disabled = !registrationReady;
  submitLabel.textContent = registrationReady ? '送出報名' : '報名系統準備中';
  systemNotice.hidden = registrationReady;
}
let attempt = { signature: '', id: '' };
let pending = false;
let selectedStatus = {};

function alertMessage(message) {
  formAlert.textContent = message;
  formAlert.hidden = false;
}
function clearErrors() {
  form.querySelectorAll('.field-error').forEach((element) => { element.hidden = true; element.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((element) => element.removeAttribute('aria-invalid'));
}
function showErrors(errors) {
  for (const [name, message] of Object.entries(errors)) {
    const error = document.getElementById(`error-${name}`);
    if (!error || typeof message !== 'string') continue;
    error.textContent = message;
    error.hidden = false;
    form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `error-${name}${name === 'age' ? ' age-note' : ''}`);
    });
  }
}
function formValues() {
  const data = new FormData(form);
  return {
    session_id: String(data.get('session_id') || ''), name: String(data.get('name') || '').trim(), age: String(data.get('age') || ''),
    organization: String(data.get('organization') || '').trim(), profession: String(data.get('profession') || ''),
    email: String(data.get('email') || '').trim(), phone: String(data.get('phone') || '').trim(),
    consent: data.get('consent') === 'on', website: String(data.get('website') || ''),
  };
}
async function readAvailability() {
  setRegistrationReady(false);
  if (!apiBase) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${apiBase}/api/registration-status`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    const data = await response.json();
    setRegistrationReady(response.ok && data.ready === true);
    if (Array.isArray(data.sessions)) {
      data.sessions.forEach((session) => {
        if (!SESSION_IDS.includes(session.id)) return;
        selectedStatus[session.id] = session.status;
        const isClosed = ['full', 'closed'].includes(session.status);
        const input = form.querySelector(`[name="session_id"][value="${session.id}"]`);
        const badge = form.querySelector(`[data-status="${session.id}"]`);
        if (input) { input.disabled = isClosed; if (isClosed) input.checked = false; }
        if (badge) badge.textContent = session.status === 'full' ? '已額滿' : session.status === 'closed' ? '已截止' : '免費參加';
      });
    }
  } catch { setRegistrationReady(false); }
  finally { clearTimeout(timeout); }
}
void readAvailability();

form.addEventListener('input', (event) => {
  const name = event.target.name;
  if (!name) return;
  const error = document.getElementById(`error-${name}`);
  if (error) { error.hidden = true; error.textContent = ''; }
  event.target.removeAttribute('aria-invalid');
  formAlert.hidden = true;
});

document.querySelectorAll('[data-session]').forEach((link) => link.addEventListener('click', () => {
  const id = link.dataset.session;
  const input = form.querySelector(`[name="session_id"][value="${id}"]`);
  if (input && !input.disabled) input.checked = true;
  const error = document.getElementById('error-session_id');
  error.hidden = true;
}));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending) return;
  if (!registrationReady) { alertMessage(PREPARING_MESSAGE); systemNotice.focus(); return; }
  clearErrors();
  formAlert.hidden = true;
  const values = formValues();
  const errors = validateRegistration(values);
  if (Object.keys(errors).length) {
    showErrors(errors);
    form.querySelector(`[name="${Object.keys(errors)[0]}"]`)?.focus();
    return;
  }
  if (['full', 'closed'].includes(selectedStatus[values.session_id])) {
    alertMessage('這個場次已額滿或截止，請選擇另一場次或聯繫活動窗口。');
    return;
  }
  if (!apiBase) { alertMessage(PREPARING_MESSAGE); return; }
  const payload = { ...values, age: Number(values.age) };
  attempt = submissionAttempt(attempt, payload, () => crypto.randomUUID());
  pending = true;
  fields.disabled = true;
  submitLabel.textContent = '正在確認報名資料…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${apiBase}/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
      body: JSON.stringify({ ...payload, submission_id: attempt.id }),
    });
    const data = await response.json();
    const receipt = response.ok ? confirmedReceipt(data) : null;
    if (receipt) {
      document.getElementById('receipt-value').textContent = receipt;
      form.reset();
      form.hidden = true;
      const success = document.getElementById('registration-success');
      success.hidden = false;
      success.focus();
      attempt = { signature: '', id: '' };
    } else {
      if (data.fieldErrors && typeof data.fieldErrors === 'object') showErrors(data.fieldErrors);
      const messages = {
        service_unavailable: PREPARING_MESSAGE,
        retry_same_submission: '目前還無法確認報名結果，請保留本頁並稍後重試。我們會使用同一筆提交編號，避免重複報名。',
        duplicate: '此電子郵件已報名同一場次。如需確認或更正，請聯繫活動窗口。',
        full: '這個場次已額滿，請選擇另一場次或聯繫活動窗口。',
        closed: '這個場次已截止報名，請聯繫活動窗口。',
        rate_limited: '操作較頻繁，請稍候再試。',
        invalid: '請檢查下方欄位，再送出報名。',
      };
      alertMessage(messages[data.code] || (response.status === 503 ? PREPARING_MESSAGE : '目前無法確認報名結果，請稍後重試或聯繫活動窗口。'));
      if (['full', 'closed'].includes(data.code)) void readAvailability();
    }
  } catch {
    alertMessage('連線中斷，目前無法確認報名結果。請保留本頁並稍後重試，系統會沿用同一筆提交編號。若需協助，請聯繫活動窗口。');
  } finally {
    clearTimeout(timeout);
    pending = false;
    fields.disabled = false;
    submitLabel.textContent = registrationReady ? '送出報名' : '報名系統準備中';
  }
});

const toggle = document.getElementById('menu-toggle');
const menu = document.getElementById('mobile-menu');
function closeMenu() { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', '開啟選單'); }
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
  menu.hidden = !open;
});
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); } });

const story = document.querySelector('.photo-story');
const slides = [...document.querySelectorAll('.photo-story-slide')];
const pauseButton = document.getElementById('pause-slides');
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
let slideIndex = 0;
let paused = media.matches;
let interval;
function displaySlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => { slide.classList.toggle('is-current', i === slideIndex); slide.setAttribute('aria-hidden', String(i !== slideIndex)); });
  document.getElementById('slide-number').textContent = String(slideIndex + 1).padStart(2, '0');
}
function refreshPlayback() {
  clearInterval(interval);
  const stopped = paused || media.matches;
  pauseButton.textContent = stopped ? '播放' : '暫停';
  pauseButton.setAttribute('aria-label', stopped ? '播放影像輪播' : '暫停影像輪播');
  pauseButton.hidden = media.matches;
  if (!stopped) interval = setInterval(() => { if (!document.hidden) displaySlide(slideIndex + 1); }, 6500);
}
document.getElementById('previous-slide').addEventListener('click', () => { paused = true; displaySlide(slideIndex - 1); refreshPlayback(); });
document.getElementById('next-slide').addEventListener('click', () => { paused = true; displaySlide(slideIndex + 1); refreshPlayback(); });
pauseButton.addEventListener('click', () => { paused = !paused; refreshPlayback(); });
story.addEventListener('focusin', (event) => { if (event.target !== pauseButton) { paused = true; refreshPlayback(); } });
media.addEventListener('change', () => { paused = media.matches; refreshPlayback(); });
refreshPlayback();
