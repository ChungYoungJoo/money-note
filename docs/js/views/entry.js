// [입력] 탭 — 금액 키패드, 카테고리, 카드/현금, 날짜, 메모.

import { num, won, esc, fmtDate, relativeDayLabel, addDays, onClick, sum, toast, josaRo } from '../util.js';
import { METHODS } from '../defaults.js';
import { indexById } from '../store.js';
import { suggest, learn, getLastUsed, setLastUsed } from '../autocat.js';

const MAX_DIGITS = 9; // 999,999,999원
const SUGGEST_DELAY = 250; // 메모를 치는 도중 계속 바뀌지 않도록 잠깐 기다린다

export async function render(root, ctx) {
  const st = ctx.state.entry;
  const cats = await ctx.store.categories();
  const chipCats = cats.slice();

  const editing = Boolean(st.editingId);

  if (st.categoryId && !chipCats.some((c) => c.id === st.categoryId)) {
    if (editing) {
      // 수정 중인 내역의 카테고리가 보관 처리됐더라도 그대로 보여 준다.
      const all = await ctx.store.allCategories();
      const hidden = all.find((c) => c.id === st.categoryId);
      if (hidden) chipCats.push(hidden);
    } else {
      // 새로 적는 중인데 고른 카테고리가 사라졌다면 선택을 푼다.
      st.categoryId = null;
    }
  }

  // ③ 마지막에 쓴 카테고리·결제수단을 기본값으로. (앱을 새로 연 직후에만 걸린다.
  //    저장 직후에는 방금 쓴 값이 state 에 그대로 남아 있기 때문)
  if (!editing && !st.categoryId) {
    const last = getLastUsed();
    if (last && chipCats.some((c) => c.id === last.categoryId)) {
      st.categoryId = last.categoryId;
      if (last.method === 'cash' || last.method === 'card') st.method = last.method;
    }
  }

  root.innerHTML = `
    <div class="navbar">
      <button class="iconbtn" type="button" data-day="-1" aria-label="전날">‹</button>
      <div class="nav-label">
        ${esc(fmtDate(st.date))}
        ${relativeDayLabel(st.date) ? `<span class="sub">${esc(relativeDayLabel(st.date))}</span>` : ''}
      </div>
      <button class="iconbtn" type="button" data-day="1" aria-label="다음날">›</button>
    </div>

    <div class="card">
      <div class="amount-display${st.amount ? '' : ' placeholder'}" id="amountView">
        ${st.amount ? num(st.amount) : '0'}<span class="unit">원</span>
      </div>
      <div class="quick-amounts">
        <button type="button" data-add="1000">+1천</button>
        <button type="button" data-add="5000">+5천</button>
        <button type="button" data-add="10000">+1만</button>
        <button type="button" data-add="50000">+5만</button>
      </div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-key="${n}">${n}</button>`).join('')}
        <button type="button" data-key="00" class="wide-key">00</button>
        <button type="button" data-key="0">0</button>
        <button type="button" data-key="back" class="wide-key" aria-label="지우기">⌫</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">카테고리</div>
      ${
        chipCats.length
          ? `<div class="chips">${chipCats
              .map(
                (c) => `<button type="button" class="chip${c.id === st.categoryId ? ' selected' : ''}" data-cat="${esc(
                  c.id
                )}">${esc(c.emoji || '✨')} ${esc(c.name)}</button>`
              )
              .join('')}</div>`
          : '<div class="empty">카테고리가 없습니다. [설정] 탭에서 추가하세요.</div>'
      }
    </div>

    <div class="card">
      <div class="section-title">결제수단</div>
      <div class="segmented">
        ${METHODS.map(
          (m) =>
            `<button type="button" data-method="${m.id}" class="${m.id === st.method ? 'selected' : ''}">${m.emoji} ${
              m.label
            }</button>`
        ).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-title">날짜 · 메모</div>
      <div class="row" style="margin-bottom:8px">
        <input type="date" id="dateInput" value="${esc(st.date)}" />
      </div>
      <input type="text" id="memoInput" maxlength="200" placeholder="메모 — 적으면 카테고리를 자동으로 골라 줍니다" value="${esc(
        st.memo
      )}" />
      <div class="hint" id="autoHint" hidden></div>
    </div>

    ${
      editing
        ? `<div class="btn-row" style="margin-bottom:10px">
             <button class="btn secondary" type="button" id="cancelBtn">취소</button>
             <button class="btn" type="button" id="saveBtn">수정 저장</button>
           </div>
           <button class="btn danger slim" type="button" id="deleteBtn" style="margin-bottom:14px">이 내역 삭제</button>`
        : `<button class="btn" type="button" id="saveBtn" style="margin-bottom:14px">저장</button>`
    }

    <div class="card" id="dayPreview"><div class="empty">불러오는 중…</div></div>
  `;

  const amountView = root.querySelector('#amountView');
  const memoInput = root.querySelector('#memoInput');
  const dateInput = root.querySelector('#dateInput');
  const saveBtn = root.querySelector('#saveBtn');

  function paintAmount() {
    amountView.innerHTML = `${st.amount ? num(st.amount) : '0'}<span class="unit">원</span>`;
    amountView.classList.toggle('placeholder', !st.amount);
  }

  function setAmountDigits(digits) {
    const trimmed = String(digits).replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
    st.amount = trimmed === '0' ? '' : trimmed;
    paintAmount();
  }

  function setDate(iso) {
    st.date = iso;
    root.querySelector('.nav-label').innerHTML =
      `${esc(fmtDate(iso))}${relativeDayLabel(iso) ? `<span class="sub">${esc(relativeDayLabel(iso))}</span>` : ''}`;
    dateInput.value = iso;
    paintPreview();
  }

  onClick(root, '[data-key]', (btn) => {
    const key = btn.dataset.key;
    if (key === 'back') setAmountDigits(st.amount.slice(0, -1));
    else if (key === '00') setAmountDigits(st.amount ? st.amount + '00' : '');
    else setAmountDigits(st.amount + key);
  });

  onClick(root, '[data-add]', (btn) => {
    const next = (Number(st.amount) || 0) + Number(btn.dataset.add);
    setAmountDigits(String(next));
  });

  onClick(root, '[data-day]', (btn) => setDate(addDays(st.date, Number(btn.dataset.day))));

  onClick(root, '[data-cat]', (btn) => {
    st.categoryId = btn.dataset.cat;
    // 직접 고른 뒤에는 메모를 더 쳐도 자동 분류가 그 선택을 덮지 않는다.
    st.categoryTouched = true;
    paintChips();
    showHint(null);
  });

  onClick(root, '[data-method]', (btn) => {
    st.method = btn.dataset.method;
    root.querySelectorAll('[data-method]').forEach((el) => el.classList.toggle('selected', el === btn));
  });

  const hintBox = root.querySelector('#autoHint');
  let suggestTimer = null;

  function paintChips() {
    root.querySelectorAll('[data-cat]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.cat === st.categoryId);
    });
  }

  function showHint(hit) {
    if (!hit) {
      hintBox.hidden = true;
      hintBox.textContent = '';
      return;
    }
    const why = hit.reason === 'learned' ? '전에 고른 대로' : '메모를 보고';
    hintBox.innerHTML = `💡 ${esc(why)} <b>${esc(hit.category.emoji || '')} ${esc(
      hit.category.name
    )}</b>${esc(josaRo(hit.category.name))} 골랐어요. 다르면 다른 칩을 누르세요.`;
    hintBox.hidden = false;
  }

  function runSuggest() {
    // 수정 중이거나 사용자가 이미 카테고리를 직접 골랐으면 건드리지 않는다.
    if (editing || st.categoryTouched) return;
    const hit = suggest(st.memo, chipCats);
    if (!hit || hit.category.id === st.categoryId) {
      showHint(hit && hit.category.id === st.categoryId ? hit : null);
      return;
    }
    st.categoryId = hit.category.id;
    paintChips();
    showHint(hit);
  }

  memoInput.addEventListener('input', () => {
    st.memo = memoInput.value;
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(runSuggest, SUGGEST_DELAY);
  });

  dateInput.addEventListener('change', () => {
    if (dateInput.value) setDate(dateInput.value);
  });

  saveBtn.addEventListener('click', async () => {
    const amount = Number(st.amount) || 0;
    if (amount <= 0) return toast('금액을 입력하세요', 'error');
    if (!st.categoryId) return toast('카테고리를 고르세요', 'error');

    saveBtn.disabled = true;
    try {
      const payload = {
        spent_on: st.date,
        category_id: st.categoryId,
        amount,
        method: st.method,
        memo: st.memo,
      };
      if (st.editingId) {
        await ctx.store.updateExpense(st.editingId, payload);
        // 수정도 학습 대상이다. 자동 분류가 틀렸을 때 사용자가 고친 결과가 여기로 들어온다.
        learn(payload.memo, payload.category_id);
        setLastUsed(payload.category_id, payload.method);
        st.editingId = null;
        st.amount = '';
        st.memo = '';
        st.categoryTouched = false;
        toast('수정했어요');
        ctx.go('daily', { date: payload.spent_on });
        return;
      }
      await ctx.store.addExpense(payload);
      learn(payload.memo, payload.category_id);
      setLastUsed(payload.category_id, payload.method);
      st.amount = '';
      st.memo = '';
      st.categoryTouched = false;
      memoInput.value = '';
      paintAmount();
      showHint(null);
      toast(`${won(amount)} 저장했어요`);
      paintPreview();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  const cancelBtn = root.querySelector('#cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      resetEntry(ctx.state);
      ctx.go('daily');
    });
  }

  const deleteBtn = root.querySelector('#deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('이 내역을 삭제할까요?')) return;
      deleteBtn.disabled = true;
      try {
        await ctx.store.deleteExpense(st.editingId);
        resetEntry(ctx.state);
        toast('삭제했어요');
        ctx.go('daily');
      } catch (err) {
        deleteBtn.disabled = false;
        toast(err.message, 'error');
      }
    });
  }

  async function paintPreview() {
    const box = root.querySelector('#dayPreview');
    box.innerHTML = '<div class="empty">불러오는 중…</div>';
    try {
      const rows = await ctx.store.day(st.date);
      const byId = indexById(await ctx.store.allCategories());
      const total = sum(rows, (r) => r.amount);
      box.innerHTML = `
        <div class="row between" style="margin-bottom:6px">
          <div class="section-title" style="margin:0">${esc(fmtDate(st.date))} 내역</div>
          <strong>${esc(won(total))}</strong>
        </div>
        ${
          rows.length
            ? `<div class="item-list">${rows.map((r) => itemRow(r, byId)).join('')}</div>`
            : '<div class="empty">아직 입력한 내역이 없어요</div>'
        }
      `;
    } catch (err) {
      box.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  }

  paintPreview();
}

function itemRow(row, byId) {
  const cat = byId.get(row.category_id);
  return `
    <div class="item" style="cursor:default">
      <span class="item-emoji">${esc(cat ? cat.emoji : '❓')}</span>
      <span class="item-main">
        <span class="item-cat">${esc(cat ? cat.name : '알 수 없음')}</span>
        <span class="tag tag-${row.method === 'cash' ? 'cash' : 'card'}">${row.method === 'cash' ? '현금' : '카드'}</span>
        ${row.memo ? `<span class="item-memo">${esc(row.memo)}</span>` : ''}
      </span>
      <span class="item-amount">${esc(won(row.amount))}</span>
    </div>`;
}

/** 편집 상태를 깨끗이 되돌린다. daily 뷰에서 편집을 걸 때와 짝이 되는 함수. */
export function resetEntry(state) {
  state.entry.editingId = null;
  state.entry.amount = '';
  state.entry.memo = '';
  state.entry.categoryTouched = false;
}
