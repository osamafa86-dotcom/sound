-- مخطط قاعدة بيانات منصة «مقام» — يُنفَّذ مرة واحدة في محرر SQL بلوحة تحكم Supabase
-- (Dashboard → SQL Editor → New query → الصق ونفّذ)

-- جدول التوليدات المحفوظة في مكتبة المستخدم
create table if not exists public.generations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tts', 'song')),
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
