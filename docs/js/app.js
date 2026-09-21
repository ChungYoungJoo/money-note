// 앱 부트스트랩 — 탭 전환과 화면 그리기.

import { todayISO, thisMonth, monthOf, esc } from './util.js';
import { store } from './store.js';
import * as entry from './views/entry.js';
import * as daily from './views/daily.js';
import * as monthly from './views/monthly.js';
import * as settings from './views/settings.js';

const views = { entry, daily, monthly, settings };
const titles = { entry: '머니노트', daily: '일별 내역', monthly: '월별 요약', settings: '설정' };

const state = {
  tab: 'entry',
  date: todayISO(),
  month: thisMonth(),
  entry: {
    date: todayISO(),
    amount: '',
    categoryId: null,
    method: 'card',
    memo: '',
    editingId: null,
  },
};

const ctx = { store, state, go, refresh };

function go(tab, options) {
  const opts = options || {};
  if (opts.date) {
    state.date = opts.date;
    state.month = monthOf(opts.date);
  }
  if (state.tab === 'entry' && tab !== 'entry') {
    // 입력 화면을 떠나면 편집 중이던 내역은 놓아준다.
    entry.resetEntry(state);
  }
  if (tab === 'daily' && !opts.date) {
    state.month = monthOf(state.date);
  }
  state.tab = tab;
  refresh();
}

/**
 * 화면을 다시 그린다. 매번 <main> 을 새로 만들어 끼우기 때문에
 * 각 화면이 컨테이너에 건 이벤트 핸들러가 쌓이지 않는다.
 */
async function refresh() {
  const old = document.getElementById('view');
  const root = document.createElement('main');
  root.id = 'view';
  root.className = 'view loading';
  root.setAttribute('aria-live', 'polite');
  old.replaceWith(root);

  syncChrome();
  window.scrollTo(0, 0);

  try {
    await views[state.tab].render(root, ctx);
  } catch (err) {
    root.innerHTML = `<div class="error-box"><strong>화면을 그리지 못했습니다.</strong><br />${esc(
      err && err.message ? err.message : String(err)
    )}</div>`;
  }
  root.classList.remove('loading');
}

function syncChrome() {
  document.getElementById('topTitle').textContent = titles[state.tab] || '머니노트';
  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const badge = document.getElementById('modeBadge');
  if (store.mode === 'local') {
    badge.textContent = '로컬 저장';
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => go(btn.dataset.tab));
});

// 앱을 켜 둔 채 자정을 넘긴 경우에만 날짜를 오늘로 맞춘다.
// (사용자가 일부러 고른 날짜를 화면 복귀 때마다 되돌리지 않기 위해 날짜가 실제로
//  바뀌었는지 비교한다.)
let knownToday = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const today = todayISO();
  if (today === knownToday) return;
  knownToday = today;
  if (state.entry.editingId) return;
  state.entry.date = today;
  state.date = today;
  state.month = monthOf(today);
  refresh();
});

refresh();
