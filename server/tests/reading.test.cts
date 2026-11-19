const { test } = require('node:test');
const assert = require('node:assert/strict');
const { annotationMatcher, parseInlineAnnotations } = require('../../client/utils/inlineAnnotations');
const { saveMissingAnalysis } = require('../src/ai/saveAnalysis');

test('注释按原文位置定位，支持繁简对应、跨显示换行和正文过期保护', () => {
  const notes = [{ word:'锦字',explanation:'书信',line:0,start:3,end:5,source_text:'𠮷封锦锦字。' }];
  const match = annotationMatcher(new Map(),notes);
  assert.deepEqual(match('𠮷封錦\n錦字。','𠮷封锦\n锦字。',{ line:0,offset:0 }),
    [{ word:'錦字',explanation:'书信',start:4,end:6 }]);
  assert.deepEqual(match('𠮷封锦锦字。',undefined,{line:1,offset:0}),[]);
  assert.deepEqual(match('改封锦锦字。',undefined,{line:0,offset:0}),[]);
});

test('同一词出现多次时结构化注释只锚定选定位置', () => {
  const match = annotationMatcher(new Map([['春','春天']]),[
    { word:'春',explanation:'春天',line:0,start:2,end:3,source_text:'春又春。' },
  ]);
  assert.deepEqual(match('春又春。',undefined,{line:0,offset:0}),[{word:'春',explanation:'春天',start:2,end:3}]);
  const legacy = annotationMatcher(parseInlineAnnotations('①锦字：书信。\n②凭阑：倚靠栏杆。'));
  assert.equal(legacy('凭阑寄锦字。').length,2);
  assert.equal(annotationMatcher(new Map([['a.b','字面量']]))('aXb a.b').length,1);
});

function database(initial: Record<string, string | null>, concurrent?: (row: any) => void, failure?: string) {
  const row = {...initial};
  let writes = 0;
  let first = true;
  const client = { rpc: async () => ({ error: { code:'PGRST202' } }), from: () => ({
    select: () => ({ eq: () => ({ single: async () => {
      const data = {...row};
      if (first) { first=false; concurrent?.(row); }
      return { data,error:null };
    } }) }),
    update: (patch: Record<string,string>) => ({ eq: () => {
      const check = (field: string,value: any) => {
        writes++;
        if (failure) return Promise.resolve({error:new Error(failure)});
        if (row[field] === value) Object.assign(row,patch);
        return Promise.resolve({error:null});
      };
      return { eq:check,is:check };
    } }),
  }) };
  return { client,row,writes:() => writes };
}
const generated = { annotation:'机器注释',translation:'机器译文',appreciation:'机器赏析' };

test('生成只补空缺，保留编辑内容，并保护生成期间的人工更新',async () => {
  const db = database({ annotation:'人工注释',translation:null,appreciation:'' },(row: any) => { row.translation='编辑刚保存的译文'; });
  const saved=await saveMissingAnalysis(db.client,'poem',generated);
  assert.equal(saved.annotation,'人工注释');
  assert.equal(saved.translation,'编辑刚保存的译文');
  assert.equal(saved.appreciation,'机器赏析');
  assert.equal(db.writes(),2);
});

test('数据库拒绝写入时不能把未保存的生成内容当成成功',async () => {
  const db=database({annotation:null,translation:null,appreciation:null},undefined,'拒绝写入');
  await assert.rejects(saveMissingAnalysis(db.client,'poem',generated),/拒绝写入/);
});

test('长文拆段和曲牌分块保留注释在原文中的位置',() => {
  const { prepareReading } = require('../../client/utils/readingLayout');
  const content='  '+('春又春。'.repeat(90));
  const layout=prepareReading({title:'文',genre:'文章',content},false);
  assert.ok(layout.blocks.length>1);
  for (const block of layout.blocks) {
    assert.equal(Array.from(content).slice(block.sourceOffset,block.sourceOffset+Array.from(block.text).length).join(''),block.text);
  }
  const qu='  【青杏子】春又春。（旦云）春又春。';
  const blocks=prepareReading({title:'曲',genre:'曲',content:qu},false).blocks;
  for (const block of blocks.filter((b:any) => b.sourceLine!==undefined)) {
    assert.equal(Array.from(qu).slice(block.sourceOffset,block.sourceOffset+Array.from(block.text).length).join(''),block.text);
  }
});
