-- 仅在需要撤回本次资料迁移时，在同一 Supabase 项目 SQL Editor 手动运行。
-- 恢复本次修改字段；保留新增字段/索引/API，避免影响新版本运行。
-- 恢复后会撤回迁移以来对这些字段的编辑，请先确认没有需要保留的新资料。
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('guanwen_migrations'));
UPDATE public.authors t SET canonical_author_id=r.canonical_author_id,bio=r.bio,
 evaluation=r.evaluation,timeline=r.timeline,editorial_sources=r.editorial_sources
FROM guanwen_internal.migration_backup b,
LATERAL jsonb_populate_record(NULL::public.authors,b.row_data) r
WHERE b.version='20261119_reading' AND b.table_name='authors' AND t.id::text=b.row_id;
UPDATE public.poems t SET author_id=r.author_id,annotation_notes=r.annotation_notes,
 creation_background=r.creation_background,background_source=r.background_source
FROM guanwen_internal.migration_backup b,
LATERAL jsonb_populate_record(NULL::public.poems,b.row_data) r
WHERE b.version='20261119_reading' AND b.table_name='poems' AND t.id::text=b.row_id;
UPDATE public.works t SET author_id=r.author_id
FROM guanwen_internal.migration_backup b,
LATERAL jsonb_populate_record(NULL::public.works,b.row_data) r
WHERE b.version='20261119_reading' AND b.table_name='works' AND t.id::text=b.row_id;
UPDATE public.relationships t SET author_id=r.author_id,related_author_id=r.related_author_id
FROM guanwen_internal.migration_backup b,
LATERAL jsonb_populate_record(NULL::public.relationships,b.row_data) r
WHERE b.version='20261119_reading' AND b.table_name='relationships' AND t.id::text=b.row_id;
UPDATE public.reading_logs t SET author_id=r.author_id
FROM guanwen_internal.migration_backup b,
LATERAL jsonb_populate_record(NULL::public.reading_logs,b.row_data) r
WHERE b.version='20261119_reading' AND b.table_name='reading_logs' AND t.id::text=b.row_id;
-- 回退后保留版本标记，防止误重复执行旧迁移覆盖回退后的新编辑。
NOTIFY pgrst,'reload schema';
COMMIT;
