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

-- ============================================================
-- 10) عقل المنصة المتقدم — الإشارات الضمنية والتقييم الآلي وسلالات البرومبتات
-- ============================================================

-- الإشارات الضمنية: كل تفاعل ذي معنى (استماع كامل، حفظ، تنزيل، مشاركة،
-- إعادة توليد، اختيار نسخة) يتحول وقود تعلم — الوزن موجب رضاً وسالب نفوراً
create table if not exists public.signals (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  weight real not null,
  voice_id text,
  maqam_id text,
  settings jsonb,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signals_voice_idx on public.signals (voice_id, created_at desc);
create index if not exists signals_maqam_idx on public.signals (maqam_id, created_at desc);

alter table public.signals enable row level security;
-- الكتابة والقراءة عبر مفتاح الخدمة من الخادم حصراً

-- ملخص إشارات كل صوت — يُدمج مع نجوم التقييم في ترتيب الكتالوج
create or replace view public.voice_signal_scores as
select
  voice_id,
  count(*)::int          as signals_count,
  round(avg(weight)::numeric, 3) as avg_weight
from public.signals
where voice_id is not null
group by voice_id;

-- التقييم الآلي: العقل ينقد نفسه — دقة نطق الأصوات والتزام الأغاني بالمقام
create table if not exists public.auto_evals (
  id bigserial primary key,
  kind text not null,          -- tts | song
  voice_id text,
  maqam_id text,
  variant_id bigint,
  score real not null,         -- 0..1
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auto_evals_voice_idx on public.auto_evals (voice_id, created_at desc);
create index if not exists auto_evals_variant_idx on public.auto_evals (variant_id);

alter table public.auto_evals enable row level security;

-- ملخص التقييم الآلي لكل صوت
create or replace view public.voice_auto_scores as
select
  voice_id,
  count(*)::int as evals_count,
  round(avg(score)::numeric, 3) as avg_auto
from public.auto_evals
where kind = 'tts' and voice_id is not null
group by voice_id;

-- سلالات البرومبتات المتنافسة لكل مقام — أساس التطور الذاتي
create table if not exists public.prompt_variants (
  id bigserial primary key,
  maqam_id text not null,
  prompt text not null,
  source text not null default 'seed',   -- seed | reflection
  active boolean not null default true,
  uses int not null default 0,
  score_sum real not null default 0,
  score_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists prompt_variants_maqam_idx on public.prompt_variants (maqam_id, active);

alter table public.prompt_variants enable row level security;

-- ============================================================
-- 11) ذاكرة البرومبتات — صياغات وكيل البرومبتات بتقييم أصحابها
-- ============================================================

create table if not exists public.prompt_crafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type_id text not null,
  platform text,
  brief text not null,
  result jsonb not null,
  score int,
  -- 1 = اشتغل ممتاز (يصبح مثالاً للصياغات القادمة) / -1 = لم ينفع
  feedback smallint,
  created_at timestamptz not null default now()
);

create index if not exists prompt_crafts_user_idx on public.prompt_crafts (user_id, created_at desc);
create index if not exists prompt_crafts_type_feedback_idx on public.prompt_crafts (type_id, feedback);

alter table public.prompt_crafts enable row level security;

drop policy if exists "برومبتاتي: قراءة" on public.prompt_crafts;
create policy "برومبتاتي: قراءة" on public.prompt_crafts
  for select using (auth.uid() = user_id);
-- الكتابة عبر مفتاح الخدمة من الخادم حصراً

-- تنظيف دوري اختياري للمهام القديمة (Dashboard → Database → Extensions → pg_cron):
-- select cron.schedule('cleanup-song-jobs', '0 * * * *',
--   $$delete from public.song_jobs where created_at < now() - interval '1 day'$$);


-- ============================================================
-- 11) لوحة مالك النظام — إعدادات حيّة وسجل تدقيق
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

-- ------------------------------------------------------------
-- 12) المعرض العام — أعمال ينشرها أصحابها باختيارهم ليراها الجميع
-- ------------------------------------------------------------
alter table public.generations
  add column if not exists is_public boolean not null default false;

-- فهرس جزئي: المعرض يقرأ المنشور فقط، فلا يدفع ثمن الأرشيف الخاص كله
create index if not exists generations_public_idx
  on public.generations (created_at desc)
  where is_public;

-- النشر وإلغاؤه تعديل يخص صاحب العمل وحده
drop policy if exists "أعمالي فقط: تعديل" on public.generations;
create policy "أعمالي فقط: تعديل" on public.generations
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- المنشور للمعرض يقرؤه أي زائر — الخاص يبقى خاصاً بسياساته أعلاه
drop policy if exists "المعرض العام: قراءة" on public.generations;
create policy "المعرض العام: قراءة" on public.generations
  for select using (is_public);
