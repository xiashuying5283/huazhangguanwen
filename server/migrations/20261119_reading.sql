CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE public.authors
  ADD COLUMN IF NOT EXISTS canonical_author_id varchar(36) REFERENCES public.authors(id),
  ADD COLUMN IF NOT EXISTS evaluation text,
  ADD COLUMN IF NOT EXISTS timeline jsonb,
  ADD COLUMN IF NOT EXISTS editorial_sources jsonb;
ALTER TABLE public.poems
  ADD COLUMN IF NOT EXISTS annotation_notes jsonb,
  ADD COLUMN IF NOT EXISTS creation_background text,
  ADD COLUMN IF NOT EXISTS background_source jsonb,
  ADD COLUMN IF NOT EXISTS analysis_provenance jsonb DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS guanwen_poems_title_trgm ON public.poems USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guanwen_poems_body_trgm ON public.poems USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guanwen_poems_traditional_trgm ON public.poems USING gin (content_traditional gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guanwen_poems_author_page ON public.poems (author_id, created_at, id);
CREATE INDEX IF NOT EXISTS guanwen_entries_page ON public.collection_entries (work_id, sort_order, id);

CREATE OR REPLACE FUNCTION public.guanwen_author_counts(author_ids text[])
RETURNS TABLE(author_id varchar, poem_count bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.author_id, count(*) FROM public.poems p WHERE p.author_id = ANY(author_ids) GROUP BY p.author_id
$$;

CREATE OR REPLACE FUNCTION public.guanwen_work_counts(work_ids text[])
RETURNS TABLE(work_id text,poem_count bigint)
LANGUAGE sql STABLE SET search_path=public AS $$
 WITH entries AS (SELECT e.work_id,count(*) AS total FROM public.collection_entries e WHERE e.work_id=ANY(work_ids) GROUP BY e.work_id),
 readings AS (SELECT p.work_id,count(*) AS total FROM public.poems p WHERE p.work_id=ANY(work_ids) GROUP BY p.work_id)
 SELECT w.id::text,coalesce(e.total,p.total,0) FROM public.works w
 LEFT JOIN entries e ON e.work_id=w.id LEFT JOIN readings p ON p.work_id=w.id
 WHERE w.id=ANY(work_ids)
$$;

CREATE OR REPLACE FUNCTION public.guanwen_search(keyword text, page_offset integer DEFAULT 0, page_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
 WITH params AS (
   SELECT left(trim(keyword),128) AS q, greatest(page_offset,0) AS skip,
     least(60,greatest(page_limit,1)) AS take
 ), pattern AS (
   SELECT *, '%' || replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_') || '%' AS term FROM params
 ), matches AS (
   SELECT p.id, p.title, p.dynasty, p.genre, p.author_id, a.name AS author_name,
     p.cover_emoji, p.background_hint, p.work_id, w.name AS work_name,
     CASE WHEN p.title = x.q THEN 0 WHEN p.title ILIKE x.term THEN 1 ELSE 2 END AS priority
   FROM public.poems p LEFT JOIN public.authors a ON a.id = p.author_id
   LEFT JOIN public.works w ON w.id = p.work_id CROSS JOIN pattern x
   WHERE x.q <> '' AND (p.title ILIKE x.term OR
     (char_length(x.q)>=2 AND (p.content ILIKE x.term OR p.content_traditional ILIKE x.term)))
 ), page AS (
   SELECT * FROM matches ORDER BY priority, title, id
   OFFSET (SELECT skip FROM params) LIMIT (SELECT take+1 FROM params)
 ), shown AS (
   SELECT * FROM page ORDER BY priority,title,id LIMIT (SELECT take FROM params)
 )
 SELECT jsonb_build_object(
   'authors', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM (
     SELECT id,name,dynasty,avatar_emoji FROM public.authors, pattern x
     WHERE canonical_author_id IS NULL AND x.skip=0 AND x.q<>'' AND name ILIKE x.term
     ORDER BY CASE WHEN name=x.q THEN 0 ELSE 1 END,name,id LIMIT 10
   ) a),'[]'::jsonb),
   'works', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM (
     SELECT id,name,era,cover_emoji,author_id FROM public.works, pattern x
     WHERE x.skip=0 AND x.q<>'' AND name ILIKE x.term ORDER BY name,id LIMIT 10
   ) w),'[]'::jsonb),
   'poems', COALESCE((SELECT jsonb_agg(to_jsonb(p)-'priority' ORDER BY priority,title,id) FROM shown p),'[]'::jsonb),
   'has_more', (SELECT count(*) FROM page) > (SELECT take FROM params),
   'offset',(SELECT skip FROM params), 'limit',(SELECT take FROM params)
 )
$$;

-- 行锁和只补空缺规则同时保护人工内容；来源与正文一同保存。
CREATE OR REPLACE FUNCTION public.guanwen_fill_analysis(target_id text,generated jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE current_row public.poems%ROWTYPE; field_name text; provenance jsonb;
BEGIN
 SELECT * INTO current_row FROM public.poems WHERE id=target_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '作品不存在'; END IF;
 provenance := coalesce(current_row.analysis_provenance,'{}'::jsonb);
 FOREACH field_name IN ARRAY ARRAY['annotation','translation','appreciation'] LOOP
  IF coalesce(trim(to_jsonb(current_row)->>field_name),'')='' THEN
   IF coalesce(trim(generated->>field_name),'')='' THEN RAISE EXCEPTION '生成内容不完整'; END IF;
   provenance := jsonb_set(provenance,ARRAY[field_name],jsonb_build_object('kind','ai','verified',false,'generated_at',now()));
  END IF;
 END LOOP;
 UPDATE public.poems SET
 annotation=CASE WHEN coalesce(trim(annotation),'')='' THEN trim(generated->>'annotation') ELSE annotation END,
 translation=CASE WHEN coalesce(trim(translation),'')='' THEN trim(generated->>'translation') ELSE translation END,
 appreciation=CASE WHEN coalesce(trim(appreciation),'')='' THEN trim(generated->>'appreciation') ELSE appreciation END,
 analysis_provenance=provenance WHERE id=target_id RETURNING * INTO current_row;
 RETURN jsonb_build_object('annotation',current_row.annotation,'translation',current_row.translation,'appreciation',current_row.appreciation);
END
$$;
REVOKE EXECUTE ON FUNCTION public.guanwen_fill_analysis(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guanwen_fill_analysis(text,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
