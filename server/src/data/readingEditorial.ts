type Source = { title: string; url: string };
type WorkContext = { creation_background: string; background_source: Source };
type AuthorContext = { evaluation: string; timeline: { year: string; event: string }[]; editorial_sources: Source[] };

const liuYongCorpus = { title: '《全宋词》柳永卷', url: 'https://www.shigeku.org/xlib/gd/qsc/0003.htm' };
const houQingLu = { title: '赵令畤《侯鲭录》卷五', url: 'https://ctext.org/wiki.pl?chapter=6359952&if=en&remap=gb' };
const luXi = { title: '《卢溪文集》四库本提要', url: 'https://zh.wikisource.org/zh-hans/盧溪文集_(四庫全書本)/全覽1' };

export const workContexts: Record<string, WorkContext> = {
  'df844ca7-6ad7-484d-accc-b450863ccd11': {
    creation_background: '《全宋词》将本篇编在柳永小石调《凤栖梧》三首中的第二首。《凤栖梧》又名《蝶恋花》。本篇通过登楼、望远和饮酒写相思。底本未标明作年、地点或所思之人。王国维后来借结尾两句比喻求学立业的第二重境界，这是此词在近代的一次重要接受。',
    background_source: liuYongCorpus,
  },
  'd4c60512-b5be-4030-9c6a-eb64d333d06e': {
    creation_background: '本篇是《全宋词》所收柳永小石调《凤栖梧》三首中的第三首。词中以夜间寻访和男女相会为情境，蜀锦、丝障、熏炉、斗帐等器物构成了室内景象。底本未标明作年、地点或人物身份，具体情境可从词中所写理解。',
    background_source: liuYongCorpus,
  },
  'abea40d4-abf5-4d3e-9d57-abb9a3655222': {
    creation_background: '本篇出自赵令畤据唐代元稹《莺莺传》（又名《会真记》）改编的商调《蝶恋花》鼓子词，见《侯鲭录》卷五。原组作品用散文讲述故事，间以词章供歌唱。本篇对应崔莺莺写信并寄赠玉环、彩丝和文竹茶具的段落。词中的女性口吻来自故事人物。',
    background_source: houQingLu,
  },
  '573d382e-12e4-4f3c-88b9-c18e16ad382e': {
    creation_background: '《全宋词》题下注「赠丁爽、丁旦及第」，点明王庭珪写此词庆贺丁氏兄弟登科。上片想象两人一同入月宫折桂，下片由临江送别转为期许二人日后获朝廷重用。具体作年暂缺可核的记载。',
    background_source: { title: '《全宋词》王庭珪卷', url: 'https://ctext.org/wiki.pl?chapter=463427&if=gb&remap=gb' },
  },
};

export const authorContexts: Record<string, AuthorContext> = {
  'li-bai': {
    evaluation: '李白诗歌想象瑰丽，语言自然明快。山水、饮酒与明月反复入诗，既写豪情，也写客居与离别。',
    timeline: [
      { year: '701', event: '李白出生。' },
      { year: '742', event: '应召来到长安，供奉翰林。' },
      { year: '744', event: '离开长安，重启漫游。' },
      { year: '762', event: '卒于当涂。' },
    ],
    editorial_sources: [{ title: '年表资料 · 香港教育局', url: 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/20240708_PDF3.pdf' }],
  },
  'ad964d3e-4467-455c-ac2f-a4850ff55a8b': {
    evaluation: '柳永擅长把人物行动、眼前景物和内心变化铺叙成一条清楚的线索。他大量创作慢词，扩展了词写行旅、都市和离别的篇幅，短章也常以口语点透情感。《凤栖梧》两首便各有侧重，一首以望远、试醉写相思，一首从回廊、半掩的门写到室内相会。王国维借「衣带渐宽」两句说明求学立业的第二境界，体现了柳词在后世的另一种读法。',
    timeline: [
      { year: '早年', event: '初名三变，后以柳永、字耆卿行世，早年已以填词闻名。' },
      { year: '1034', event: '宋仁宗景祐元年登进士第。' },
      { year: '晚年', event: '官至屯田员外郎，后世称柳屯田。' },
    ],
    editorial_sources: [
      { title: '四库本《乐章集》提要', url: 'https://ctext.org/wiki.pl?chapter=442813&if=gb' },
      { title: '叶梦得《避暑录话》卷下', url: 'https://www.shidianguji.com/zh/book/NGJ892411999011173118943/chapter/1luz5ytthjwhg' },
      { title: '王国维《人间词话》', url: 'https://zh.wikisource.org/zh-hans/人間詞話_(1926)' },
    ],
  },
  '0984b151-da94-4975-ad4e-f1d21e301a9a': {
    evaluation: '赵令畤的商调《蝶恋花》把传奇情节拆成可讲可唱的段落。以「尺素重重」一阕为例，散文交代莺莺所寄的信物和来历，词则让人物借玉环、彩丝、泪竹说出相思。散文推进故事，曲词留住情绪，是理解宋代鼓子词的重要例子。《侯鲭录》还保存了他与苏轼等人的交游、诗话和笔记材料。',
    timeline: [
      { year: '1091', event: '苏轼出守颍州，与签书颍州公事的赵令畤相识，后来为他改字德麟。' },
      { year: '绍兴初', event: '袭封安定郡王，同知行在大宗正事。' },
      { year: '1134', event: '卒于宋高宗绍兴四年。' },
    ],
    editorial_sources: [
      { title: '苏轼《赵德麟字说》', url: 'https://wk.100ke.info/zh-hans/趙德麟字說' },
      houQingLu,
      { title: '《侯鲭录》四库本提要', url: 'https://zh.wikisource.org/zh-hans/侯鯖錄' },
    ],
  },
  'c384a593-a965-4f3f-a12a-fcc07519f964': {
    evaluation: '杨万里在《卢溪先生文集序》中既肯定王庭珪诗句之工，也看重他面对时局时敢于直言。王庭珪送别胡铨的诗能见其刚直，本篇贺丁氏兄弟登科，则显示他能把日常酬赠写得轻快有生气。结尾以商高宗求傅说的旧典托出对新科进士的期待，提升了贺词的分量。',
    timeline: [
      { year: '1118', event: '宋徽宗政和八年登进士第，后任茶陵县丞。' },
      { year: '绍兴年间', event: '胡铨因上疏反对议和遭贬，王庭珪作诗送行，后来因送别诗获罪。' },
      { year: '1170', event: '宋孝宗乾道六年除直敷文阁。' },
      { year: '1172', event: '卒。其诗文收入《卢溪文集》。' },
    ],
    editorial_sources: [
      luXi,
      { title: '杨万里《卢溪先生文集序》', url: 'https://zh.wikisource.org/zh-hans/盧溪先生文集序' },
    ],
  },
};
