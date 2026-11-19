import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { authorContexts, workContexts } from '../src/data/readingEditorial';
import annotations from '../../client/utils/inlineAnnotations';

config({ path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true });
const client = createClient(process.env.COZE_SUPABASE_URL!,process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const results: { name:string;ok:boolean;detail:unknown }[]=[];
async function check(name:string,run:()=>Promise<unknown>) {
 try { const detail=await run(); results.push({name,ok:true,detail}); console.log('PASS',name,JSON.stringify(detail)); }
 catch(error) { const detail=error instanceof Error ? error.message : JSON.stringify(error); results.push({name,ok:false,detail}); console.error('FAIL',name,detail); }
}
async function count(table:string,column?:string,value?:string) {
 let query=client.from(table).select('id',{count:'exact',head:true});
 if(column) query=query.eq(column,value);
 const {count,error}=await query; if(error) throw error; return count ?? 0;
}
await check('作品数量',async()=>({poems:await count('poems')}));
await check('三个作者别名与旧引用',async()=>{
 const pairs=[['e5a3fcc4-be77-499a-aa35-cfdf7dbbedfb','ad964d3e-4467-455c-ac2f-a4850ff55a8b','柳永'],['e4711fcd-53ec-4e2f-9e30-8d2f7d6ecdc9','c384a593-a965-4f3f-a12a-fcc07519f964','王庭珪'],['3dd3c9d0-a089-4464-90bb-ecf0dfab924f','ffca63d7-fac0-43c4-b2ee-3d73aea82334','晏殊']];
 const totals=[];
 for(const [old,canonical,name] of pairs) {
  const {data,error}=await client.from('authors').select('id,name,canonical_author_id').eq('id',old).single();if(error) throw error;
  assert.equal(data.canonical_author_id,canonical);assert.equal(data.name,name);
  for(const table of ['poems','works','relationships','reading_logs']) assert.equal(await count(table,'author_id',old),0,table+'旧作者引用');
  assert.equal(await count('relationships','related_author_id',old),0);
  totals.push({name,poems:await count('poems','author_id',canonical)});
 }
 return totals;
});
await check('人物评价年表与出处已入库',async()=>{
 for(const [id,fields] of Object.entries(authorContexts)) {
  const {data,error}=await client.from('authors').select('evaluation,timeline,editorial_sources').eq('id',id).single();if(error) throw error;
  assert.equal(data.evaluation,fields.evaluation);assert.deepEqual(data.timeline,fields.timeline);assert.deepEqual(data.editorial_sources,fields.editorial_sources);
 }
 return {authors:Object.keys(authorContexts).length};
});
await check('四篇创作背景与出处已入库',async()=>{
 for(const [id,fields] of Object.entries(workContexts)) {
  const {data,error}=await client.from('poems').select('creation_background,background_source').eq('id',id).single();if(error) throw error;
  assert.equal(data.creation_background,fields.creation_background);assert.deepEqual(data.background_source,fields.background_source);
 }
 return {poems:Object.keys(workContexts).length};
});
await check('结构化注释与原文位置一致',async()=>{
 let total=0,notes=0;
 for(let offset=0;;offset+=100) {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../migrations/20261119_supabase_editor.sql',import.meta.url),'utf8');
  const ids = [...sql.matchAll(/UPDATE public.poems SET annotation_notes=.*?WHERE id='([^']+)'/gu)].map((match) => match[1]);
  const {data,error}=await client.from('poems').select('id,content,annotation_notes').in('id',ids.slice(offset,offset+100)).order('id');if(error) throw error;
  assert.equal(data?.length,ids.slice(offset,offset+100).length);
  assert.ok(data?.every(poem => Array.isArray(poem.annotation_notes)), '注释字段应已入库');
  for(const poem of data??[]) {
   const lines=poem.content.split(/\r?\n/u);
   for(const note of poem.annotation_notes) {
    assert.equal(lines[note.line],note.source_text,poem.id+'原文行');
    assert.equal(Array.from(note.source_text).slice(note.start,note.end).join(''),note.word,poem.id+'词语位置');
    const match=annotations.annotationMatcher(new Map(),[note]);
    assert.equal(match?.(lines[note.line],undefined,{line:note.line,offset:0}).length,1); notes++;
   }
   total++;
  }
  if(!data||data.length<100) break;
 }
 assert.ok(total>=81,'预期至少81篇已有注释锚点');return {poems:total,notes};
});
await check('批量人物与文集统计函数',async()=>{
 const authorIds=['li-bai',...Object.keys(authorContexts)];
 const authors=await client.rpc('guanwen_author_counts',{author_ids:authorIds});if(authors.error) throw authors.error;
 for(const row of authors.data??[]) assert.equal(Number(row.poem_count),await count('poems','author_id',row.author_id));
 const works=await client.from('works').select('id');if(works.error) throw works.error;
 const counts=await client.rpc('guanwen_work_counts',{work_ids:works.data.map(row=>row.id)});if(counts.error) throw counts.error;
 assert.equal(counts.data.length,works.data.length);
 for(const row of counts.data) assert.equal(Number(row.poem_count),(await count('collection_entries','work_id',row.work_id)) || await count('poems','work_id',row.work_id));
 return {authors:authors.data.length,works:counts.data.length};
});
await check('索引搜索RPC与稳定分页',async()=>{
 const search=async(q:string,offset=0)=>{console.log('CHECK search',q,offset);const result=await client.rpc('guanwen_search',{keyword:q,page_offset:offset,page_limit:5});if(result.error)throw result.error;return result.data;};
 const first=await search('蝶恋花'),second=await search('蝶恋花',5);
 assert.equal(first.poems.length,5);assert.ok(first.has_more);assert.equal(second.poems.length,5);
 assert.equal(new Set([...first.poems,...second.poems].map(p=>p.id)).size,10);
 assert.ok(first.poems.every(p=>p.title==='蝶恋花'),'完整标题优先');
 const author = await fetch('http://localhost:'+(process.env.SERVER_PORT || '9091')+'/api/v1/search?q='+encodeURIComponent('柳永')).then(r=>r.json());assert.equal(author.authors.filter(a=>a.name==='柳永').length,1);
 const body=await search('衣带渐宽');assert.ok(body.poems.length>0);
 const trad=await search('衣帶漸寬');assert.ok(trad.poems.length>0);
 const wildcard=await fetch('http://localhost:'+(process.env.SERVER_PORT || '9091')+'/api/v1/search?q='+encodeURIComponent('%%%%')).then(r=>r.json());assert.equal(wildcard.poems.length,0);
 return {titleHits:first.poems.length,bodyHits:body.poems.length,traditionalHits:trad.poems.length,duplicates:0};
});
await check('AI原子保存RPC存在且服务端可调用',async()=>{
 // A missing ID fails before any UPDATE; verification never changes a real work.
 const {error}=await client.rpc('guanwen_fill_analysis',{target_id:'00000000-0000-0000-0000-000000000000',generated:{}});
 assert.ok(error?.message.includes('作品不存在'),JSON.stringify(error));return {errorBeforeWrite:true};
});
const directory=new URL('../../.local/',import.meta.url);await mkdir(directory,{recursive:true});
await writeFile(new URL('migration-verification.json',directory),JSON.stringify({time:new Date().toISOString(),results},null,2));
if(results.some(row=>!row.ok)) process.exitCode=1;
