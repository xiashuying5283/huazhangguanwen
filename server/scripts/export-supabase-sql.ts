import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
import { authorContexts, workContexts } from '../src/data/readingEditorial';
import annotations from '../../client/utils/inlineAnnotations';
const { parseInlineAnnotations } = annotations;

// Uses the same Supabase HTTP connection as Express. Does not execute SQL or mutate data.
config({ path: fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true });
const url = process.env.COZE_SUPABASE_URL;
const key = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('缺少现有 Supabase 配置，请检查根目录 .env。');
const client = createClient(url,key,{ auth: { persistSession: false, autoRefreshToken: false } });
const quote = (value: string) => "'" + value.replace(/'/g,"''") + "'";
const json = (value: unknown) => quote(JSON.stringify(value)) + '::jsonb';
const version = '20261119_reading';
const merges = [
  ['e5a3fcc4-be77-499a-aa35-cfdf7dbbedfb','ad964d3e-4467-455c-ac2f-a4850ff55a8b','柳永'],
  ['e4711fcd-53ec-4e2f-9e30-8d2f7d6ecdc9','c384a593-a965-4f3f-a12a-fcc07519f964','王庭珪'],
  ['3dd3c9d0-a089-4464-90bb-ecf0dfab924f','ffca63d7-fac0-43c4-b2ee-3d73aea82334','晏殊'],
];
const ids = [...new Set([...merges.flatMap(([a,b]) => [a,b]),...Object.keys(authorContexts)])];
const idList = ids.map(quote).join(',');
const backgrounds = Object.keys(workContexts).map(quote).join(',');
const statements: string[] = [];
const conditions: Record<string,string> = {
  authors: `id IN (${idList})`,
  poems: `author_id IN (${idList}) OR id IN (${backgrounds}) OR (annotation IS NOT NULL AND trim(annotation)<>'')`,
  works: `author_id IN (${idList})`,
  relationships: `author_id IN (${idList}) OR related_author_id IN (${idList})`,
  reading_logs: `author_id IN (${idList})`,
};
for (const [table,where] of Object.entries(conditions)) {
  statements.push(`INSERT INTO guanwen_internal.migration_backup(version,table_name,row_id,row_data)
    SELECT ${quote(version)},${quote(table)},t.id::text,to_jsonb(t) FROM public.${table} t WHERE ${where}
    ON CONFLICT DO NOTHING;`);
}
for (const [old,canonical,name] of merges) {
  statements.push(`IF (SELECT count(*) FROM public.authors WHERE id IN (${quote(old)},${quote(canonical)}) AND name=${quote(name)} AND dynasty LIKE '%宋%') <> 2 THEN
    RAISE EXCEPTION '人物身份校验失败：${name}'; END IF;`);
  statements.push(`UPDATE public.authors a SET bio=b.bio FROM public.authors b WHERE a.id=${quote(canonical)} AND b.id=${quote(old)} AND coalesce(trim(a.bio),'')='' AND coalesce(trim(b.bio),'')<>'';`);
  for (const table of ['poems','works','relationships','reading_logs']) statements.push(`UPDATE public.${table} SET author_id=${quote(canonical)} WHERE author_id=${quote(old)};`);
  statements.push(`UPDATE public.relationships SET related_author_id=${quote(canonical)} WHERE related_author_id=${quote(old)};`);
  statements.push(`UPDATE public.authors SET canonical_author_id=${quote(canonical)} WHERE id=${quote(old)};`);
}
for (const [id,fields] of Object.entries(authorContexts)) statements.push(`UPDATE public.authors SET evaluation=${quote(fields.evaluation)},timeline=${json(fields.timeline)},editorial_sources=${json(fields.editorial_sources)} WHERE id=${quote(id)};`);
for (const [id,fields] of Object.entries(workContexts)) statements.push(`UPDATE public.poems SET creation_background=${quote(fields.creation_background)},background_source=${json(fields.background_source)} WHERE id=${quote(id)};`);
let migratedNotes=0;
for (let offset=0;;offset+=500) {
  const { data,error } = await client.from('poems').select('id,content,annotation').not('annotation','is',null).order('id').range(offset,offset+499);
  if (error) throw error;
  for (const poem of data ?? []) {
    const terms=parseInlineAnnotations(poem.annotation);
    const notes: unknown[]=[];
    (poem.content ?? '').split(/\r?\n/u).forEach((line: string,index: number) => {
      for (const [word,explanation] of terms) {
        let found=line.indexOf(word);
        while (found>=0) {
          const start=Array.from(line.slice(0,found)).length;
          notes.push({ word,explanation,line:index,start,end:start+Array.from(word).length,source_text:line });
          found=line.indexOf(word,found+word.length);
        }
      }
    });
    if (notes.length) {
      statements.push(`UPDATE public.poems SET annotation_notes=${json(notes)} WHERE id=${quote(poem.id)} AND content=${quote(poem.content)} AND annotation=${quote(poem.annotation)} AND annotation_notes IS NULL;`);
      migratedNotes++;
    }
  }
  if (!data || data.length<500) break;
}
const schema=await readFile(new URL('../migrations/20261119_reading.sql',import.meta.url),'utf8');
const output=`-- 观文 Supabase SQL Editor 迁移。使用现有项目，无需 DATABASE_URL。
-- 事务内备份所改记录；不会删除诗文或作者。重复运行不重复修改资料。
BEGIN;
SET LOCAL search_path=public,extensions;
SELECT pg_advisory_xact_lock(hashtext('guanwen_migrations'));
CREATE SCHEMA IF NOT EXISTS guanwen_internal;
REVOKE ALL ON SCHEMA guanwen_internal FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS guanwen_internal.migration_backup(version text,table_name text,row_id text,row_data jsonb,PRIMARY KEY(version,table_name,row_id));
CREATE TABLE IF NOT EXISTS guanwen_internal.migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now());
${schema}
DO $guanwen$
DECLARE before_count bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM guanwen_internal.migrations WHERE version=${quote(version)}) THEN RETURN; END IF;
 SELECT count(*) INTO before_count FROM public.poems;
 ${statements.join('\n ')}
 IF (SELECT count(*) FROM public.poems) <> before_count THEN RAISE EXCEPTION '作品数量校验失败'; END IF;
 INSERT INTO guanwen_internal.migrations(version) VALUES(${quote(version)});
END $guanwen$;
COMMIT;
`;
await writeFile(new URL('../migrations/20261119_supabase_editor.sql',import.meta.url),output);
console.log(`已生成 SQL Editor 迁移脚本，包含 ${migratedNotes} 篇注释锚点。未修改数据库。`);
