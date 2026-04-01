-- Supabase: نفّذ هذا السكربت في SQL Editor (لوحة المشروع).
-- يحفظ كل إكمال (اسم، بريد، مسار، أعلى 3 تخصصات بمعرفات السجل MAJ_*)
-- ويمنع قراءة الصفوف من المتصفح (حماية الخصوصية) مع السماح بدالة تجميع آمنة.

create table if not exists public.orientation_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_instance_id text,
  name text not null,
  email text not null,
  track_id text not null,
  major_rank_1 text,
  major_rank_2 text,
  major_rank_3 text
);

grant usage on schema public to anon, authenticated;
grant insert on table public.orientation_submissions to anon;

alter table public.orientation_submissions enable row level security;

-- إدراج من التطبيق (مفتاح anon) مع شروط تقلل الإساءة وتتماشى مع REGISTRY (ليست true دائماً)
-- مسارات الثانوي المعتمدة في data/registry-bundle.js:
drop policy if exists "orientation_submissions_anon_insert" on public.orientation_submissions;
create policy "orientation_submissions_anon_insert"
  on public.orientation_submissions
  for insert
  to anon
  with check (
    track_id in (
      'TRACK_GEN',
      'TRACK_SHAR',
      'TRACK_BUS',
      'TRACK_CSE',
      'TRACK_HLT'
    )
    and char_length(btrim(name)) between 2 and 200
    and char_length(btrim(email)) between 3 and 320
    and btrim(email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (
      visitor_instance_id is null
      or char_length(visitor_instance_id) between 8 and 128
    )
    and (
      major_rank_1 is null
      or (char_length(major_rank_1) between 4 and 64 and major_rank_1 ~ '^MAJ_[A-Z0-9_]+$')
    )
    and (
      major_rank_2 is null
      or (char_length(major_rank_2) between 4 and 64 and major_rank_2 ~ '^MAJ_[A-Z0-9_]+$')
    )
    and (
      major_rank_3 is null
      or (char_length(major_rank_3) between 4 and 64 and major_rank_3 ~ '^MAJ_[A-Z0-9_]+$')
    )
  );

-- لا تضف سياسة SELECT لـ anon — لا يقرأ الزائر الصفوف مباشرة

-- تجميع شائع التخصصات (أعلى 10) + عدد الجلسات المسجّلة — بدون كشف بيانات شخصية
create or replace function public.major_popularity_stats()
returns json
language sql
security definer
set search_path = public
as $$
  with expanded as (
    select major_rank_1 as mid from public.orientation_submissions where major_rank_1 is not null and major_rank_1 <> ''
    union all
    select major_rank_2 from public.orientation_submissions where major_rank_2 is not null and major_rank_2 <> ''
    union all
    select major_rank_3 from public.orientation_submissions where major_rank_3 is not null and major_rank_3 <> ''
  ),
  ranked as (
    select mid, count(*)::int as c
    from expanded
    group by mid
    order by c desc
    limit 10
  )
  select json_build_object(
    'submission_count', (select count(*)::int from public.orientation_submissions),
    'top_majors', coalesce(
      (select json_agg(json_build_object('major_id', mid, 'count', c) order by c desc) from ranked),
      '[]'::json
    )
  );
$$;

grant execute on function public.major_popularity_stats() to anon, authenticated;

-- شريط النشاط بصفحة المسار: الاسم + التخصص صاحب المركز الأول (major_rank_1) فقط
create or replace function public.track_feed_recent(limit_n int default 15)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select json_agg(
        json_build_object(
          'at', s.created_at,
          'name', s.name,
          'major_id', s.major_rank_1
        )
        order by s.created_at desc
      )
      from (
        select created_at, name, major_rank_1
        from public.orientation_submissions
        where major_rank_1 is not null and btrim(major_rank_1) <> ''
        order by created_at desc
        limit greatest(1, least(coalesce(limit_n, 15), 40))
      ) s
    ),
    '[]'::json
  );
$$;

grant execute on function public.track_feed_recent(integer) to anon, authenticated;

-- عند إعادة الاختبار بنفس البريد: حذف الصفوف السابقة قبل إدراج نتيجة جديدة (يُستدعى من التطبيق)
create or replace function public.delete_orientation_by_email(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if p_email is null or length(btrim(p_email)) < 3 then
    return 0;
  end if;
  delete from public.orientation_submissions
  where lower(btrim(email)) = lower(btrim(p_email));
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.delete_orientation_by_email(text) to anon, authenticated;
