-- مخطط قاعدة بيانات منصة «مقام» — يُنفَّذ مرة واحدة في محرر SQL بلوحة تحكم Supabase
-- (Dashboard → SQL Editor → New query → الصق ونفّذ)

-- جدول التوليدات المحفوظة في مكتبة المستخدم
create table if not exists public.generations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tts', 'song', 'recording')),
  title text not null,
  details text,
  mime_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

-- حماية على مستوى الصفوف: كل مستخدم يرى ويدير توليداته فقط
alter table public.generations enable row level security;

create policy "generations_select_own" on public.generations
  for select using (auth.uid() = user_id);

create policy "generations_insert_own" on public.generations
  for insert with check (auth.uid() = user_id);

create policy "generations_delete_own" on public.generations
  for delete using (auth.uid() = user_id);

-- حاوية التخزين الخاصة بالملفات الصوتية (خاصة — الوصول عبر روابط موقّعة)
insert into storage.buckets (id, name, public)
  values ('audio', 'audio', false)
  on conflict (id) do nothing;

-- سياسات التخزين: مجلد كل مستخدم باسم معرّفه (user_id/file.mp3)
create policy "audio_select_own" on storage.objects
  for select using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio_delete_own" on storage.objects
  for delete using (
    bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- المرحلة 5: نظام المهام الدائم وتحديد معدل الاستخدام
-- ============================================================

-- مهام توليد الأغاني — يديرها الخادم بمفتاح الخدمة حصراً
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

-- عدّادات تحديد معدل الاستخدام (نافذة ثابتة)
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

alter table public.rate_limits enable row level security;

-- استهلاك ذرّي لمحاولة من النافذة — يعيد هل ما زالت ضمن الحد
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

-- الدالة للخادم فقط — تُمنع عن مفاتيح المتصفح
revoke execute on function public.consume_rate_limit(text, int, int) from anon, authenticated;

-- تنظيف دوري اختياري للمهام القديمة (فعّله من Dashboard → Database → Extensions → pg_cron):
-- select cron.schedule('cleanup-song-jobs', '0 * * * *',
--   $$delete from public.song_jobs where created_at < now() - interval '1 day'$$);

-- ============================================================
-- المرحلة 7: الأصوات المستنسخة (معمل الصوت)
-- ============================================================

-- الأصوات المستنسخة — id هو معرّف الصوت لدى ElevenLabs، وكل صوت مربوط بمالكه
create table if not exists public.custom_voices (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_voices_user_idx on public.custom_voices (user_id, created_at desc);

-- RLS مفعّلة بلا سياسات: الإدارة عبر مفتاح الخدمة من الخادم حصراً
-- (الإنشاء يتطلب موافقة صريحة تُتحقق خادمياً في مسار الاستنساخ)
alter table public.custom_voices enable row level security;

-- ملاحظة: نفّذ هذا السطر إن كنت أنشأت الجدول قبل المرحلة 7 لتحديث قيد الأنواع:
-- alter table public.generations drop constraint generations_kind_check;
-- alter table public.generations add constraint generations_kind_check check (kind in ('tts','song','recording'));
