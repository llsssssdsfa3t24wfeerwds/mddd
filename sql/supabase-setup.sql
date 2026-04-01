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

-- إدراج من التطبيق (مفتاح anon) فقط
drop policy if exists "orientation_submissions_anon_insert" on public.orientation_submissions;
create policy "orientation_submissions_anon_insert"
  on public.orientation_submissions
  for insert
  to anon
  with check (true);

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
