// [설정] 탭 — 카테고리 편집, 저장 위치 안내, 내보내기/가져오기.

import { esc, onClick, toast, download, todayISO } from '../util.js';
import { indexById } from '../store.js';

const ALL_FROM = '2000-01-01';
const ALL_TO = '2099-12-31';

export async function render(root, ctx) {
  const cats = await ctx.store.allCategories();
  const local = ctx.store.mode === 'local';

  root.innerHTML = `
    <div class="card">
      <div class="section-title">카테고리</div>
      <div id="catList">
        ${cats
          .map(
            (c) => `
          <div class="cat-edit-row" data-id="${esc(c.id)}">
            <input class="cat-emoji" type="text" maxlength="4" value="${esc(c.emoji || '')}" aria-label="이모지" />
            <input class="cat-name" type="text" maxlength="20" value="${esc(c.name)}" aria-label="카테고리 이름" />
            <button class="iconbtn" type="button" data-move="-1" aria-label="위로">▲</button>
            <button class="iconbtn" type="button" data-move="1" aria-label="아래로">▼</button>
            <button class="iconbtn" type="button" data-remove="1" aria-label="삭제">✕</button>
          </div>`
          )
          .join('')}
      </div>
      ${cats.length ? '' : '<div class="empty">카테고리가 없습니다</div>'}
      <div class="row" style="margin-top:12px">
        <input class="cat-emoji" type="text" id="newEmoji" maxlength="4" value="✨" aria-label="새 이모지" />
        <input type="text" id="newName" maxlength="20" placeholder="새 카테고리 이름" />
        <button class="iconbtn" type="button" id="addCat" aria-label="추가">＋</button>
      </div>
      <div class="notice" style="margin-top:10px">
        이미 쓴 적 있는 카테고리는 지워도 과거 내역이 이름을 잃지 않도록 목록에서만 감춰집니다(보관).
      </div>
    </div>

    <div class="card">
      <div class="section-title">저장 위치</div>
      <div class="notice">
        ${
          local
            ? '지금은 <strong>로컬 저장 모드</strong>입니다. 이 브라우저에만 저장되고 다른 기기에서는 보이지 않습니다.<br />' +
              '<code>docs/js/config.js</code> 에 Supabase 주소와 anon 키를 넣으면 기기끼리 동기화됩니다. ' +
              '먼저 아래에서 JSON으로 내보낸 뒤, 연결한 다음 가져오면 지금까지 쓴 내역을 그대로 옮길 수 있습니다.'
            : 'Supabase에 저장되고 있습니다. 휴대폰과 PC에서 같은 내역이 보입니다.'
        }
      </div>
    </div>

    <div class="card">
      <div class="section-title">데이터</div>
      <div class="btn-row" style="margin-bottom:8px">
        <button class="btn secondary slim" type="button" id="exportCsv">CSV 내보내기</button>
        <button class="btn secondary slim" type="button" id="exportJson">JSON 내보내기</button>
      </div>
      <button class="btn secondary slim" type="button" id="importBtn">JSON 가져오기</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden />
      <div class="notice" style="margin-top:10px">
        CSV는 엑셀에서 바로 열립니다. JSON은 백업·기기 이전용입니다.
      </div>
    </div>
  `;

  /* ---------- 카테고리 편집 ---------- */

  const catList = root.querySelector('#catList');

  catList.addEventListener('change', async (ev) => {
    const input = ev.target;
    const row = input.closest('.cat-edit-row');
    if (!row) return;
    const patch = input.classList.contains('cat-emoji')
      ? { emoji: input.value.trim() || '✨' }
      : { name: input.value.trim() };
    if (patch.name === '') {
      toast('이름은 비울 수 없어요', 'error');
      ctx.refresh();
      return;
    }
    try {
      await ctx.store.updateCategory(row.dataset.id, patch);
      toast('저장했어요');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  onClick(catList, '[data-move]', async (btn) => {
    const row = btn.closest('.cat-edit-row');
    try {
      const moved = await ctx.store.moveCategory(row.dataset.id, Number(btn.dataset.move));
      if (moved) ctx.refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  onClick(catList, '[data-remove]', async (btn) => {
    const row = btn.closest('.cat-edit-row');
    const name = row.querySelector('.cat-name').value;
    if (!window.confirm(`'${name}' 카테고리를 삭제할까요?`)) return;
    try {
      const result = await ctx.store.removeCategory(row.dataset.id);
      toast(result === 'archived' ? '쓴 내역이 있어 목록에서만 감췄어요' : '삭제했어요');
      ctx.refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const newName = root.querySelector('#newName');
  root.querySelector('#addCat').addEventListener('click', async () => {
    const name = newName.value.trim();
    if (!name) return toast('이름을 입력하세요', 'error');
    try {
      await ctx.store.addCategory(name, root.querySelector('#newEmoji').value);
      toast('추가했어요');
      ctx.refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  /* ---------- 내보내기 / 가져오기 ---------- */

  async function loadAll() {
    const [expenses, categories] = await Promise.all([
      ctx.store.expenses(ALL_FROM, ALL_TO),
      ctx.store.allCategories(),
    ]);
    return { expenses, categories };
  }

  root.querySelector('#exportCsv').addEventListener('click', async () => {
    try {
      const { expenses, categories } = await loadAll();
      const byId = indexById(categories);
      const lines = [['날짜', '카테고리', '결제수단', '금액', '메모'].join(',')];
      expenses
        .slice()
        .sort((a, b) => (a.spent_on < b.spent_on ? -1 : a.spent_on > b.spent_on ? 1 : 0))
        .forEach((e) => {
          const cat = byId.get(e.category_id);
          lines.push(
            [
              e.spent_on,
              csv(cat ? cat.name : '알 수 없음'),
              e.method === 'cash' ? '현금' : '카드',
              Math.round(Number(e.amount) || 0),
              csv(e.memo || ''),
            ].join(',')
          );
        });
      // 엑셀이 UTF-8로 읽도록 BOM을 붙인다.
      download(`머니노트-${todayISO()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
      toast(`${expenses.length}건 내보냈어요`);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  root.querySelector('#exportJson').addEventListener('click', async () => {
    try {
      const data = await loadAll();
      download(
        `머니노트-백업-${todayISO()}.json`,
        JSON.stringify({ app: 'money-note', version: 1, exported_at: new Date().toISOString(), ...data }, null, 2),
        'application/json'
      );
      toast(`${data.expenses.length}건 내보냈어요`);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const fileInput = root.querySelector('#importFile');
  root.querySelector('#importBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data.expenses) ? data.expenses : [];
      const incomingCats = Array.isArray(data.categories) ? data.categories : [];
      if (!incoming.length) return toast('가져올 내역이 없습니다', 'error');
      if (!window.confirm(`${incoming.length}건을 지금 저장소에 추가합니다. 계속할까요?`)) return;

      // 카테고리는 "이름"으로 맞춘다. 없는 이름은 새로 만든다.
      const oldIdToName = new Map(incomingCats.map((c) => [c.id, c.name]));
      const existing = await ctx.store.allCategories();
      const nameToId = new Map(existing.map((c) => [c.name, c.id]));

      for (const c of incomingCats) {
        if (!nameToId.has(c.name)) {
          const created = await ctx.store.addCategory(c.name, c.emoji);
          if (created) nameToId.set(c.name, created.id);
        }
      }

      let saved = 0;
      let skipped = 0;
      for (const e of incoming) {
        const name = oldIdToName.get(e.category_id);
        const categoryId = nameToId.get(name);
        if (!categoryId) {
          // 백업 파일에 카테고리 정보가 없는 내역. 어디로 넣을지 알 수 없어 건너뛴다.
          skipped += 1;
          continue;
        }
        await ctx.store.addExpense({
          spent_on: e.spent_on,
          category_id: categoryId,
          amount: e.amount,
          method: e.method,
          memo: e.memo,
        });
        saved += 1;
      }
      toast(skipped ? `${saved}건 가져왔어요 (카테고리를 못 찾은 ${skipped}건 제외)` : `${saved}건 가져왔어요`);
      ctx.refresh();
    } catch (err) {
      toast('가져오기 실패: ' + err.message, 'error');
    } finally {
      fileInput.value = '';
    }
  });
}

function csv(value) {
  const text = String(value === null || value === undefined ? '' : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
