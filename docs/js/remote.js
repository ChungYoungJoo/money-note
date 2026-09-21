// Supabase 백엔드. supabase-js CDN 없이 PostgREST 엔드포인트를 fetch 로 직접 호출한다.
// (의존성이 없어야 회사 PC에서도 파일만 올리면 끝나므로)

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// 대시보드에서 REST 엔드포인트(.../rest/v1/)를 통째로 복사해 넣어도 동작하도록 꼬리를 잘라낸다.
const baseUrl = String(SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const anonKey = String(SUPABASE_ANON_KEY || '').trim();

export const remoteAvailable = Boolean(baseUrl && anonKey);

async function req(path, opts) {
  const options = opts || {};
  let res;
  try {
    res = await fetch(baseUrl + '/rest/v1' + path, {
      method: options.method || 'GET',
      body: options.body,
      headers: Object.assign(
        {
          apikey: anonKey,
          Authorization: 'Bearer ' + anonKey,
          'Content-Type': 'application/json',
        },
        options.headers || {}
      ),
    });
  } catch (err) {
    throw new Error('Supabase에 연결하지 못했습니다. 인터넷 연결과 config.js의 주소를 확인하세요. (' + err.message + ')');
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.message || parsed.hint || detail;
    } catch (_) {
      /* 본문이 JSON이 아니면 원문 그대로 보여준다 */
    }
    throw new Error('Supabase ' + res.status + ': ' + detail);
  }
  if (!text) return null;
  return JSON.parse(text);
}

const RETURN_ROW = { Prefer: 'return=representation' };

function first(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export const remote = {
  mode: 'supabase',

  async categories() {
    return (await req('/categories?select=*&order=sort_order.asc,name.asc')) || [];
  },

  async addCategory(cat) {
    return first(
      await req('/categories', {
        method: 'POST',
        headers: RETURN_ROW,
        body: JSON.stringify(cat),
      })
    );
  },

  async updateCategory(id, patch) {
    return first(
      await req('/categories?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: RETURN_ROW,
        body: JSON.stringify(patch),
      })
    );
  },

  async deleteCategory(id) {
    await req('/categories?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  },

  async expenses(from, to) {
    const query =
      '/expenses?select=*' +
      '&spent_on=gte.' + encodeURIComponent(from) +
      '&spent_on=lte.' + encodeURIComponent(to) +
      '&order=spent_on.desc,created_at.desc';
    return (await req(query)) || [];
  },

  async addExpense(row) {
    return first(
      await req('/expenses', {
        method: 'POST',
        headers: RETURN_ROW,
        body: JSON.stringify(row),
      })
    );
  },

  async updateExpense(id, patch) {
    return first(
      await req('/expenses?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: RETURN_ROW,
        body: JSON.stringify(patch),
      })
    );
  },

  async deleteExpense(id) {
    await req('/expenses?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  },

  async categoryInUse(id) {
    const rows = await req('/expenses?select=id&limit=1&category_id=eq.' + encodeURIComponent(id));
    return Array.isArray(rows) && rows.length > 0;
  },
};
