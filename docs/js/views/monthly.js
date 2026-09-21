// [월별] 탭 — 그 달의 총 사용금액, 카테고리별 합계, 결제수단 비교.

import {
  won, wonShort, num, esc, fmtMonth, addMonths, monthRange, daysInMonth,
  monthOf, todayISO, parseISO, onClick,
} from '../util.js';
import { indexById, totalsByCategory, totalsByDay, totalsByMethod } from '../store.js';

export async function render(root, ctx) {
  const ym = ctx.state.month;

  root.innerHTML = `
    <div class="navbar">
      <button class="iconbtn" type="button" data-month="-1" aria-label="이전 달">‹</button>
      <div class="nav-label">${esc(fmtMonth(ym))}</div>
      <button class="iconbtn" type="button" data-month="1" aria-label="다음 달">›</button>
    </div>
    <div id="monthBody"><div class="empty">불러오는 중…</div></div>
  `;

  onClick(root, '[data-month]', (btn) => {
    ctx.state.month = addMonths(ctx.state.month, Number(btn.dataset.month));
    ctx.refresh();
  });

  const body = root.querySelector('#monthBody');
  let rows;
  let categories;
  try {
    const [from, to] = monthRange(ym);
    rows = await ctx.store.expenses(from, to);
    categories = indexById(await ctx.store.allCategories());
  } catch (err) {
    body.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    return;
  }

  if (!rows.length) {
    body.innerHTML = `<div class="card"><div class="empty">${esc(fmtMonth(ym))}에는 입력한 내역이 없어요</div></div>`;
    return;
  }

  const t = totalsByMethod(rows);
  const byCat = totalsByCategory(rows);
  const byDay = totalsByDay(rows);
  const spentDays = Object.keys(byDay).length;

  // 하루 평균은 "이번 달"이면 오늘까지, 지난 달이면 그 달 전체 일수로 나눈다.
  const isThisMonth = ym === monthOf(todayISO());
  const elapsed = isThisMonth ? parseISO(todayISO()).getDate() : daysInMonth(ym);
  const perDay = Math.round(t.total / Math.max(1, elapsed));

  const topDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];
  const maxCat = byCat.length ? byCat[0].amount : 1;

  body.innerHTML = `
    <div class="card total-hero">
      <div class="label">${esc(fmtMonth(ym))} 총 사용금액</div>
      <div class="value">${esc(won(t.total))}</div>
      <div class="sub">${num(rows.length)}건 · ${num(spentDays)}일 지출 · 하루 평균 ${esc(wonShort(perDay))}</div>
    </div>

    <div class="split">
      <div class="card pay-card">
        <div class="label">💳 카드</div>
        <div class="value">${esc(won(t.card))}</div>
        <div class="label">${pct(t.card, t.total)}%</div>
      </div>
      <div class="card pay-cash">
        <div class="label">💵 현금</div>
        <div class="value">${esc(won(t.cash))}</div>
        <div class="label">${pct(t.cash, t.total)}%</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">카테고리별 합계</div>
      ${byCat
        .map((c) => {
          const cat = categories.get(c.categoryId);
          return `
            <div class="bar-row">
              <div class="bar-head">
                <span class="name">${esc(cat ? cat.emoji : '❓')} ${esc(cat ? cat.name : '알 수 없음')}</span>
                <span class="pct">${pct(c.amount, t.total)}%</span>
                <span class="amt">${esc(won(c.amount))}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${Math.max(2, Math.round((c.amount / maxCat) * 100))}%"></div>
              </div>
            </div>`;
        })
        .join('')}
    </div>

    <div class="card">
      <div class="section-title">가장 많이 쓴 날</div>
      <div class="row between">
        <span>${esc(topDay ? `${Number(topDay.slice(8))}일` : '-')}</span>
        <strong>${esc(topDay ? won(byDay[topDay]) : '-')}</strong>
      </div>
      <button class="btn secondary slim" type="button" data-goday="${esc(topDay || '')}" style="margin-top:10px">
        이 날 내역 보기
      </button>
    </div>
  `;

  onClick(body, '[data-goday]', (btn) => {
    if (!btn.dataset.goday) return;
    ctx.state.date = btn.dataset.goday;
    ctx.go('daily');
  });
}

function pct(part, total) {
  if (!total) return '0';
  return Math.round((part / total) * 100);
}
