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
  -- 'tts' لتحويل النص إلى صوت، 'song' للأغاني والموسيقى، 'recording' لتسجيلات معمل الصوت
  kind text not null check (kind in ('tts', 'song', 'recording')),
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


-- ============================================================
-- 7) نظام المهام الدائم (توليد الأغاني على Vercel Serverless)
-- ============================================================

create table if not exists public.song_jobs (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  status text not null check (status in ('pending', 'running', 'done', 'failed')),
  stage text not null default '',
  tier text not null check (tier in ('preview', 'full')),
  request jsonb not null,
  provider text,
  mime_type text,
  mock boolean not null default false,
  fell_back text,
  error text,
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists song_jobs_created_idx on public.song_jobs (created_at desc);

-- RLS مفعّلة بلا سياسات: لا وصول من المتصفح إطلاقاً — مفتاح الخدمة يتجاوزها
alter table public.song_jobs enable row level security;

-- حاوية مؤقتة لنواتج المهام (خاصة، بلا سياسات — مفتاح الخدمة فقط)
insert into storage.buckets (id, name, public)
  values ('jobs', 'jobs', false)
  on conflict (id) do nothing;

-- ============================================================
-- 8) تحديد معدل الاستخدام الذرّي (نافذة ثابتة، لكل المسارات المكلفة)
-- ============================================================

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

alter table public.rate_limits enable row level security;

create or replace function public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rl.count + 1
    end,
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rl.window_start
    end
  returning (count <= p_limit) into allowed;
  return allowed;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from anon, authenticated;

-- ============================================================
-- 9) الأصوات المستنسخة والمصممة — مربوطة بمالكها (معمل الصوت)
-- ============================================================

create table if not exists public.custom_voices (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_voices_user_idx on public.custom_voices (user_id, created_at desc);

-- الإدارة عبر مفتاح الخدمة من الخادم حصراً (الإنشاء يتطلب موافقة صريحة تُتحقق خادمياً)
alter table public.custom_voices enable row level security;

-- تنظيف دوري اختياري للمهام القديمة (Dashboard → Database → Extensions → pg_cron):
-- select cron.schedule('cleanup-song-jobs', '0 * * * *',
--   $$delete from public.song_jobs where created_at < now() - interval '1 day'$$);


-- ============================================================
-- 10) لوحة مالك النظام — إعدادات حيّة وسجل تدقيق
-- ============================================================

-- إعدادات المنصة: مفاتيح يغيّرها المالك من اللوحة فتسري خلال ثوانٍ بلا إعادة نشر
-- (وضع الصيانة، إيقاف خدمة بعينها، الوضع التجريبي القسري، لافتة الموقع)
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS مفعّلة بلا سياسات: لا وصول من المتصفح — القراءة والكتابة بمفتاح الخدمة حصراً
alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value)
values ('platform', '{"maintenance": false, "forceMock": false, "disabledRoutes": [], "banner": ""}'::jsonb)
on conflict (key) do nothing;

-- سجل التدقيق: من فعل ماذا ومتى (تغيير رصيد، إيقاف مسار، تصفير حد، تنظيف مهام)
create table if not exists public.admin_audit (
  id bigserial primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text not null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_time_idx on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

-- فهرس زمني على سجل الاستهلاك — تقارير اللوحة تقرأ بنطاق تاريخ لكل المستخدمين
create index if not exists usage_time_idx on public.usage_events (created_at desc);

-- ملاحظة: صلاحية المالك لا تُخزَّن في القاعدة بل في متغير البيئة OWNER_EMAILS،
-- فلا يمكن منح أحدٍ نفسه صلاحية المالك بتعديل صف في الجدول.


-- ============================================================
-- 11) المشاركة العامة والنشر على فيسبوك
-- ============================================================

-- رابط عام اختياري لكل عمل: معرّف غير قابل للتخمين + مفتاح تشغيل/إيقاف.
-- الملف نفسه يبقى خاصاً في التخزين؛ الخادم وحده يكشف ما عُلّم is_public.
alter table public.generations
  add column if not exists share_id text,
  add column if not exists is_public boolean not null default false;

create unique index if not exists generations_share_id_idx
  on public.generations (share_id) where share_id is not null;

-- صفحات فيسبوك المربوطة — رمز كل صفحة مشفّر بـ AES-256-GCM قبل التخزين.
-- رمز الصفحة بلا تاريخ انتهاء، فمن يقرأه ينشر على صفحة صاحبه بلا حدّ زمني:
-- لذلك RLS مفعّلة بلا أي سياسة (لا وصول من المتصفح إطلاقاً) والتشفير فوقها.
create table if not exists public.facebook_pages (
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null,
  name text not null,
  category text,
  access_token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

alter table public.facebook_pages enable row level security;
