// [일별] 탭 — 하루 내역과 그날 합계, 그리고 그 달의 일별 합계 목록.

import {
  won, esc, fmtDate, relativeDayLabel, addDays, monthOf, fmtMonth,
  daysInMonth, pad2, weekday, weekdayIndex, onClick, todayISO, parseISO,
} from '../util.js';
import { indexById, totalsByDay, totalsByMethod } from '../store.js';

export async function render(root, ctx) {
  const date = ctx.state.date;
  const ym = monthOf(date);
  // 일별에서 달을 넘어가며 보다가 [월별] 로 가면 그 달이 보이도록 맞춰 둔다.
  ctx.state.month = ym;

  root.innerHTML = `
    <div class="navbar">
      <button class="iconbtn" type="button" data-day="-1" aria-label="전날">‹</button>
      <div class="nav-label">
        ${esc(fmtDate(date))}
        ${relativeDayLabel(date) ? `<span class="sub">${esc(relativeDayLabel(date))}</span>` : ''}
      </div>
      <button class="iconbtn" type="button" data-day="1" aria-label="다음날">›</button>
    </div>
    <div id="dayBody"><div class="empty">불러오는 중…</div></div>
  `;

  // 날짜를 옮기면 화면 전체를 다시 그린다. app.js 가 매번 새 컨테이너를 만들어
  // 주므로 여기서 건 이벤트 핸들러가 쌓이지 않는다.
  onClick(root, '[data-day]', (btn) => {
    ctx.state.date = addDays(ctx.state.date, Number(btn.dataset.day));
    ctx.refresh();
  });

  const body = root.querySelector('#dayBody');
  let monthRows;
  let categories;
  try {
    const [from, to] = [`${ym}-01`, `${ym}-${pad2(daysInMonth(ym))}`];
    monthRows = await ctx.store.expenses(from, to);
    categories = indexById(await ctx.store.allCategories());
  } catch (err) {
    body.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    return;
  }

  const dayRows = monthRows.filter((r) => r.spent_on === date);
  const dayTotals = totalsByDay(monthRows);
  const t = totalsByMethod(dayRows);
  const maxDay = Math.max(1, ...Object.values(dayTotals));
  // 이번 달이면 아직 오지 않은 날짜까지 늘어놓지 않는다. (보고 있는 날짜가 미래면 그날까지)
  const today = todayISO();
  const isThisMonth = ym === monthOf(today);
  const lastDay = isThisMonth
    ? Math.max(parseISO(today).getDate(), parseISO(date).getDate())
    : daysInMonth(ym);

  const dayList = [];
  for (let d = lastDay; d >= 1; d -= 1) {
    const iso = `${ym}-${pad2(d)}`;
    const amount = dayTotals[iso] || 0;
    const wd = weekdayIndex(iso);
    dayList.push(`
      <button class="day-row${iso === date ? ' today' : ''}" type="button" data-date="${iso}">
        <span class="day-date">${d}일<span class="wd${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}">${weekday(
      iso
    )}</span></span>
        <span class="day-bar"><span class="bar-fill" style="width:${
          amount ? Math.max(3, Math.round((amount / maxDay) * 100)) : 0
        }%"></span></span>
        <span class="day-amt${amount ? '' : ' zero'}">${amount ? esc(won(amount)) : '—'}</span>
      </button>`);
  }

  body.innerHTML = `
    <div class="card total-hero">
      <div class="label">${esc(fmtDate(date))} 합계</div>
      <div class="value">${esc(won(t.total))}</div>
      <div class="sub">${dayRows.length}건</div>
    </div>

    <div class="split">
      <div class="card pay-card"><div class="label">💳 카드</div><div class="value">${esc(won(t.card))}</div></div>
      <div class="card pay-cash"><div class="label">💵 현금</div><div class="value">${esc(won(t.cash))}</div></div>
    </div>

    <div class="card">
      <div class="section-title">내역 (눌러서 수정)</div>
      ${
        dayRows.length
          ? `<div class="item-list">${dayRows.map((r) => itemButton(r, categories)).join('')}</div>`
          : '<div class="empty">이 날은 쓴 내역이 없어요</div>'
      }
    </div>

    <div class="card">
      <div class="section-title">${esc(fmtMonth(ym))} 일별 합계</div>
      ${dayList.join('')}
    </div>
  `;

  onClick(body, '[data-date]', (btn) => {
    ctx.state.date = btn.dataset.date;
    ctx.refresh();
  });

  onClick(body, '[data-edit]', (btn) => {
    const row = dayRows.find((r) => String(r.id) === btn.dataset.edit);
    if (!row) return;
    ctx.state.entry = {
      date: row.spent_on,
      amount: String(Math.round(Number(row.amount) || 0)),
      categoryId: row.category_id,
      method: row.method === 'cash' ? 'cash' : 'card',
      memo: row.memo || '',
      editingId: row.id,
    };
    ctx.go('entry');
  });
}

function itemButton(row, categories) {
  const cat = categories.get(row.category_id);
  return `
    <button class="item" type="button" data-edit="${esc(row.id)}">
      <span class="item-emoji">${esc(cat ? cat.emoji : '❓')}</span>
      <span class="item-main">
        <span class="item-cat">${esc(cat ? cat.name : '알 수 없음')}</span>
        <span class="tag tag-${row.method === 'cash' ? 'cash' : 'card'}">${row.method === 'cash' ? '현금' : '카드'}</span>
        ${row.memo ? `<span class="item-memo">${esc(row.memo)}</span>` : ''}
      </span>
      <span class="item-amount">${esc(won(row.amount))}</span>
    </button>`;
}
