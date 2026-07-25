-- ============================================================
-- مخطط قاعدة بيانات منصة «مقام»
-- شغّل هذا الملف كاملاً في: Supabase → SQL Editor → New query → Run
-- آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1) ملفات المستخدمين — تُنشأ تلقائياً عند التسجيل
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- رصيد الكريدت: يُخصم مع كل توليد (تُدار قيمه من الخادم فقط)
  credits integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "قراءة ملفي فقط" on public.profiles;
create policy "قراءة ملفي فقط" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "تعديل ملفي فقط" on public.profiles;
create policy "تعديل ملفي فقط" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- إنشاء الملف تلقائياً عند تسجيل مستخدم جديد
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2) الأعمال المولّدة — مكتبة كل مستخدم
-- ------------------------------------------------------------
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'tts' لتحويل النص إلى صوت، 'song' للأغاني والموسيقى
  kind text not null check (kind in ('tts', 'song')),
  title text,
  -- النص المنطوق أو كلمات الأغنية
  content text,
  -- معرّف الصوت (لـ tts) أو المقام والأسلوب (للأغاني)
  voice_id text,
  maqam_id text,
  style_id text,
  -- المحرك الذي أنتج الملف فعلياً: elevenlabs / lyria / eleven-music
  provider text,
  -- الإعدادات المستخدمة، لتغذية الضبط الذاتي لاحقاً
  settings jsonb not null default '{}'::jsonb,
  -- مسار الملف داخل التخزين
  audio_path text,
  duration_sec numeric,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);
create index if not exists generations_voice_idx on public.generations (voice_id);

alter table public.generations enable row level security;

drop policy if exists "أعمالي فقط: قراءة" on public.generations;
create policy "أعمالي فقط: قراءة" on public.generations
  for select using (auth.uid() = user_id);

drop policy if exists "أعمالي فقط: إضافة" on public.generations;
create policy "أعمالي فقط: إضافة" on public.generations
  for insert with check (auth.uid() = user_id);

drop policy if exists "أعمالي فقط: حذف" on public.generations;
create policy "أعمالي فقط: حذف" on public.generations
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) التقييمات — وقود «عقل» المنصة
-- ------------------------------------------------------------
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (generation_id, user_id)
);

alter table public.ratings enable row level security;

drop policy if exists "تقييماتي: قراءة" on public.ratings;
create policy "تقييماتي: قراءة" on public.ratings
  for select using (auth.uid() = user_id);

drop policy if exists "تقييماتي: إضافة" on public.ratings;
create policy "تقييماتي: إضافة" on public.ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "تقييماتي: تعديل" on public.ratings;
create policy "تقييماتي: تعديل" on public.ratings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4) سجل الاستهلاك — حدود دقيقة مرتبطة بالحساب
-- ------------------------------------------------------------
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  route text not null,
  cost integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists usage_user_time_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

drop policy if exists "سجل استهلاكي: قراءة" on public.usage_events;
create policy "سجل استهلاكي: قراءة" on public.usage_events
  for select using (auth.uid() = user_id);
-- الكتابة تتم من الخادم بمفتاح service_role فقط (يتجاوز RLS)

-- ------------------------------------------------------------
-- 5) لوحة ترتيب الأصوات — تُحدَّث من التقييمات (يقرؤها الجميع)
-- ------------------------------------------------------------
create or replace view public.voice_scores as
select
  g.voice_id,
  count(r.id)::int              as ratings_count,
  round(avg(r.score)::numeric, 2) as avg_score
from public.generations g
join public.ratings r on r.generation_id = g.id
where g.voice_id is not null
group by g.voice_id;

-- ------------------------------------------------------------
-- 6) تخزين الملفات الصوتية
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

drop policy if exists "ملفاتي: قراءة" on storage.objects;
create policy "ملفاتي: قراءة" on storage.objects
  for select using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ملفاتي: رفع" on storage.objects;
create policy "ملفاتي: رفع" on storage.objects
  for insert with check (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ملفاتي: حذف" on storage.objects;
create policy "ملفاتي: حذف" on storage.objects
  for delete using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );
