// 날짜·금액 포맷과 잡다한 DOM 도우미.

const NUM = new Intl.NumberFormat('ko-KR');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function num(n) {
  return NUM.format(Math.round(Number(n) || 0));
}

export function won(n) {
  return num(n) + '원';
}

/** 큰 금액을 "12만 3,400원" 처럼 짧게. 요약 카드용. */
export function wonShort(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) < 10000) return won(v);
  const man = Math.floor(Math.abs(v) / 10000);
  const rest = Math.abs(v) % 10000;
  const sign = v < 0 ? '-' : '';
  return rest === 0 ? `${sign}${num(man)}만원` : `${sign}${num(man)}만 ${num(rest)}원`;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD' (로컬 시간 기준. toISOString은 UTC라 하루 밀릴 수 있어 쓰지 않음) */
export function isoOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO() {
  return isoOf(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** 'YYYY-MM-DD' -> 'YYYY-MM' */
export function monthOf(iso) {
  return String(iso).slice(0, 7);
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 'YYYY-MM' -> ['YYYY-MM-01', 'YYYY-MM-말일'] */
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${ym}-01`, `${ym}-${pad2(last)}`];
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function thisMonth() {
  return monthOf(todayISO());
}

export function weekday(iso) {
  return WEEKDAYS[parseISO(iso).getDay()];
}

/** 0=일요일, 6=토요일 */
export function weekdayIndex(iso) {
  return parseISO(iso).getDay();
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday(iso)})`;
}

export function fmtDateFull(iso) {
  const d = parseISO(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday(iso)})`;
}

export function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function relativeDayLabel(iso) {
  const t = todayISO();
  if (iso === t) return '오늘';
  if (iso === addDays(t, -1)) return '어제';
  if (iso === addDays(t, 1)) return '내일';
  return '';
}

export function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function sum(list, pick) {
  return list.reduce((acc, item) => acc + (Number(pick ? pick(item) : item) || 0), 0);
}

let toastTimer = null;
export function toast(message, kind) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = message;
  box.className = 'toast' + (kind ? ' toast-' + kind : '');
  box.hidden = false;
  // 재생 중인 애니메이션을 다시 시작시키기 위해 강제로 리플로우
  void box.offsetWidth;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.classList.remove('show');
    setTimeout(() => {
      box.hidden = true;
    }, 200);
  }, kind === 'error' ? 4000 : 1800);
}

/** 이벤트 위임: root 안에서 selector 에 맞는 요소 클릭을 받는다. */
export function onClick(root, selector, handler) {
  root.addEventListener('click', (ev) => {
    const target = ev.target.closest(selector);
    if (target && root.contains(target)) handler(target, ev);
  });
}

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
