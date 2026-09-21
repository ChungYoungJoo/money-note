-- 머니노트 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 한 번 실행하면 됩니다.
-- 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto;

-- ---------- 카테고리 ----------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  emoji      text        not null default '✨',
  sort_order integer     not null default 0,
  archived   boolean     not null default false,
  created_at timestamptz not null default now()
);

-- 같은 이름이 두 번 생기지 않도록 (가져오기 할 때도 이 제약으로 합쳐집니다)
create unique index if not exists categories_name_key on public.categories (name);

-- ---------- 지출 내역 ----------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date        not null,
  category_id uuid        not null references public.categories (id) on delete restrict,
  amount      integer     not null check (amount > 0),
  method      text        not null default 'card' check (method in ('card', 'cash')),
  memo        text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_spent_on_idx  on public.expenses (spent_on desc);
create index if not exists expenses_category_idx  on public.expenses (category_id);

-- ---------- 접근 권한 ----------
-- 이 앱은 로그인이 없습니다. anon 키로 읽고 쓰므로 anon 에 전체 권한을 엽니다.
-- 즉 "배포 URL을 아는 사람 = 내역을 보고 고칠 수 있는 사람" 입니다. URL을 공유하지 마세요.
-- 나중에 로그인을 붙이려면 이 정책을 지우고 auth.uid() 기준 정책으로 바꾸면 됩니다.
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;

drop policy if exists "anon all on categories" on public.categories;
create policy "anon all on categories"
  on public.categories for all to anon
  using (true) with check (true);

drop policy if exists "anon all on expenses" on public.expenses;
create policy "anon all on expenses"
  on public.expenses for all to anon
  using (true) with check (true);

-- ---------- 기본 카테고리 ----------
-- 앱도 빈 테이블을 보면 같은 목록을 자동으로 넣지만, 여기서 미리 넣어 두면 첫 화면이 빠릅니다.
insert into public.categories (name, emoji, sort_order) values
  ('식비',        '🍚',  0),
  ('카페/간식',   '☕',  1),
  ('교통',        '🚌',  2),
  ('생활용품',    '🧻',  3),
  ('의료/건강',   '💊',  4),
  ('교육',        '📚',  5),
  ('문화/여가',   '🎬',  6),
  ('의류/미용',   '👕',  7),
  ('경조사',      '🎁',  8),
  ('주거/공과금', '🏠',  9),
  ('통신',        '📱', 10),
  ('기타',        '✨', 11)
on conflict (name) do nothing;
