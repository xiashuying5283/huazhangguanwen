import { getSupabaseClient } from './storage/database/supabase-client';
import { pinyin } from 'pinyin-pro';
import { Converter } from 'opencc-js';
import { randomUUID } from 'crypto';

const cn2tw = Converter({ from: 'cn', to: 'tw' });

function getPinyinLine(line: string) {
  return Array.from(line.trim()).map((ch) => {
    if (/[\u3400-\u9fff]/.test(ch)) {
      const p = pinyin(ch, { toneType: 'symbol' }) || '';
      return { c: ch, p: p.replace(/[^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńň]|\d/g, '').trim() };
    }
    return { c: ch, p: '' };
  });
}

function buildContent(content: string) {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return {
    content: lines.join('\n'),
    content_traditional: lines.map((l) => cn2tw(l)).join('\n'),
    pinyin: lines.map((l) => getPinyinLine(l)),
  };
}

interface AuthorSeed {
  id: string; name: string; dynasty: string; emoji: string; bio: string;
}
interface WorkSeed {
  id: string; name: string; authorId?: string; era: string; emoji: string; description: string;
}
interface RelSeed {
  a: string; b: string; relation: string; note: string;
}
interface PoemSeed {
  title: string; authorId: string; workId?: string; dynasty: string; genre: string;
  content: string; annotation: string; translation: string; appreciation: string;
  emoji: string; bg: string;
}

const authors: AuthorSeed[] = [
  { id: 'li-bai', name: '李白', dynasty: '唐', emoji: '🌙', bio: '字太白，号青莲居士。唐代伟大的浪漫主义诗人，被后人誉为“诗仙”。诗风雄奇飘逸、想象瑰丽，喜饮酒、爱明月，一生仗剑天涯、放浪不羁。' },
  { id: 'du-fu', name: '杜甫', dynasty: '唐', emoji: '🍂', bio: '字子美，自号少陵野老。唐代伟大的现实主义诗人，被尊为“诗圣”。诗作沉郁顿挫、忧国忧民，记录了一个时代的兴衰，《三吏》《三别》传诵千古。' },
  { id: 'wang-wei', name: '王维', dynasty: '唐', emoji: '🏔️', bio: '字摩诘，号摩诘居士。盛唐山水田园诗派代表，诗中有画、画中有诗。晚年笃信佛教，诗风空灵澄澈，《辋川集》造境幽远。' },
  { id: 'bai-juyi', name: '白居易', dynasty: '唐', emoji: '🐱', bio: '字乐天，号香山居士。唐代现实主义诗人，主张“文章合为时而著，歌诗合为事而作”。诗风平易近人、妇孺皆解，《长恨歌》《琵琶行》轰动一时。' },
  { id: 'li-qingzhao', name: '李清照', dynasty: '宋', emoji: '🌸', bio: '号易安居士。宋代婉约词宗，被誉为“千古第一才女”。词作前期明丽清朗、后期凄婉沉郁，词句独辟蹊径、善用白描，情感细腻动人。' },
  { id: 'su-shi', name: '苏轼', dynasty: '宋', emoji: '🦢', bio: '字子瞻，号东坡居士。北宋文学巨匠，诗词文书画俱佳。一生坎坷却旷达乐观，词风豪放洒脱，“一蓑烟雨任平生”道尽豁达。《赤壁赋》《水调歌头》光耀千古。' },
  { id: 'tao-yuanming', name: '陶渊明', dynasty: '东晋', emoji: '🍶', bio: '字元亮，号五柳先生。中国第一位田园诗人，不为五斗米折腰，辞官归隐。诗风平淡自然、返璞归真，开创田园诗派，为后世隐逸之宗。' },
  { id: 'qu-yuan', name: '屈原', dynasty: '战国', emoji: '🌊', bio: '战国时期楚国诗人、政治家，中国浪漫主义文学奠基人。作品想象瑰丽、辞藻华美，《离骚》《九歌》开楚辞一派，象征忠贞高洁的人格。' },
  { id: 'huang-jingren', name: '黄景仁', dynasty: '清', emoji: '📖', bio: '字仲则，号鹿菲子。清代诗人，才华横溢而一生困顿，仅三十五岁而逝。诗作沉郁多情、真挚动人，“百无一用是书生”为世传诵，著有《两当轩集》。' },
  { id: 'wang-bo', name: '王勃', dynasty: '唐', emoji: '🚢', bio: '字子安，初唐四杰之首。少年英才，词采华赡、气象开阔，《滕王阁序》千古名篇，“海内存知己，天涯若比邻”传诵不衰。' },
  { id: 'liu-xiang', name: '刘向', dynasty: '西汉', emoji: '📚', bio: '西汉宗室，著名经学家、目录学家、文学家。奉命校理群书，编定《战国策》《新序》《说苑》等，为中国古典文献学奠基人物。' },
];

const works: WorkSeed[] = [
  { id: 'w-liangdang', name: '两当轩集', authorId: 'huang-jingren', era: '清', emoji: '📖', description: '清代诗人黄景仁的诗文集，共二十二卷。诗风沉郁真挚，多写身世飘零与不平之鸣。' },
  { id: 'w-zhanguoce', name: '战国策', era: '西汉', emoji: '⚔️', description: '西汉刘向编定的国别体史书，记载战国谋臣策士的言论与谋略，语言雄辩纵横、机锋四射。' },
  { id: 'w-yuefu', name: '乐府诗集', era: '宋', emoji: '🪕', description: '南宋郭茂倩编纂的乐府诗歌总集，收录先秦至唐五代的乐府诗，题材广泛、民歌色彩浓厚。' },
  { id: 'w-libaiji', name: '李太白全集', authorId: 'li-bai', era: '唐', emoji: '🐎', description: '唐代诗人李白的诗文集，收录其现存全部诗作，尽显诗仙雄奇飘逸的风采。' },
  { id: 'w-shuyu', name: '漱玉词', authorId: 'li-qingzhao', era: '宋', emoji: '🌸', description: '宋代女词人李清照的词集，词风婉约清丽，被称为“易安体”，是婉约词派的典范。' },
  { id: 'w-dongpo', name: '东坡乐府', authorId: 'su-shi', era: '宋', emoji: '🍵', description: '北宋苏轼的词集，以豪放洒脱著称，开创豪放词派，词意旷达、意境深远。' },
];

const relationships: RelSeed[] = [
  { a: 'li-bai', b: 'du-fu', relation: '挚友', note: '李杜之交是中国文学史上最动人的友谊。' },
  { a: 'du-fu', b: 'li-bai', relation: '知音', note: '杜甫视李白为知音，写有《梦李白》《春日忆李白》。' },
  { a: 'li-bai', b: 'qu-yuan', relation: '崇拜', note: '李白的浪漫诗风深受屈原影响。' },
  { a: 'wang-wei', b: 'tao-yuanming', relation: '溯源', note: '王维的田园诗承接陶渊明一脉。' },
  { a: 'su-shi', b: 'tao-yuanming', relation: '仰慕', note: '苏轼遍和陶诗，称“欲以晩节师范其万一”。' },
  { a: 'su-shi', b: 'li-qingzhao', relation: '同朝', note: '同处宋代词坛，一豪一婉各领风骚。' },
  { a: 'huang-jingren', b: 'li-bai', relation: '仰慕', note: '黄景仁自谓“敢是前身杜子美”，亦尝追摹李白。' },
  { a: 'bai-juyi', b: 'du-fu', relation: '师承', note: '白居易提倡写实，实承杜甫现实精神。' },
];

const poems: PoemSeed[] = [
  {
    title: '静夜思', authorId: 'li-bai', workId: 'w-libaiji', dynasty: '唐', genre: '五言绝句',
    content: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
    annotation: '① 疑：仿佛，好像。② 举头：抬头。③ 思乡：思念家乡。',
    translation: '明亮的月光洒在床前，好像地上泛起一层白霜。我抬起头望向那天上的明月，又低下头，深深思念自己的故乡。',
    appreciation: '这首小诗语言明白如话，却意境深远。诗人以“举头”“低头”两个连续的动作，写出游子在静夜月下由景入情、由情入思的微妙心绪。“霜”字既写月光之清冷，又暗喻内心之孤寂，千年来令无数离人动容。',
    emoji: '🌙', bg: '#FFF1DC',
  },
  {
    title: '子夜吴歌·秋歌', authorId: 'li-bai', workId: 'w-yuefu', dynasty: '唐', genre: '乐府',
    content: '长安一片月，\n万户捣衣声。\n秋风吹不尽，\n总是玉关情。\n何日平胡虏，\n良人罢远征。',
    annotation: '① 捣衣：古人洗衣，秋夜捣衣多为赶制征衣。② 玉关：玉门关，代指边塞。③ 良人：丈夫。④ 胡虏：指外族敌人。',
    translation: '长安城里洒满一片月光，千家万户传出捣衣的声音。秋风吹也吹不尽那声声思念，声声都是盼念玉门关外征人的深情。什么时候能平定边患，让我心爱的人归来，不再远征。',
    appreciation: '这首诗以月光与捣衣声起兴，由眼前景写到心中情，再由思妇之情宕开，从“玉关情”到“平胡虏”，思情与忧国融为一体。秋风吹不尽的是戍边之念，也是人间最朴素的牵挂，温柔而深沉。',
    emoji: '🌕', bg: '#E8E3FF',
  },
  {
    title: '春夜喜雨', authorId: 'du-fu', dynasty: '唐', genre: '五言律诗',
    content: '好雨知时节，\n当春乃发生。\n随风潜入夜，\n润物细无声。\n野径云俱黑，\n江船火独明。\n晓看红湿处，\n花重锦官城。',
    annotation: '① 发生：使万物萌发。② 潜：悄悄地。③ 锦官城：成都的别称。④ 花重：花朵因沾雨而显得沉重。',
    translation: '好雨似乎懂得时节，正当春天便悄然降临。它随着春风在夜里飘洒，默默滋润万物而毫无声响。田野小径上天色一片昏暗，唯有江上渔船的灯火格外明亮。天亮后去看那被雨打湿的花丛，沉甸甸的红花开满了成都城。',
    appreciation: '这首诗一“喜”字贯串全篇，却通篇不着一“喜”字。诗人以拟人之笔，写春雨“知时节”“潜入夜”“细无声”，赞其润物无私、悄然无声，实则寄寓诗人默默奉献、体物入微的高尚情怀。末联以雨后繁花收束，喜悦之情跃然纸上。',
    emoji: '🌧️', bg: '#DCEFFF',
  },
  {
    title: '山居秋暝', authorId: 'wang-wei', dynasty: '唐', genre: '五言律诗',
    content: '空山新雨后，\n天气晚来秋。\n明月松间照，\n清泉石上流。\n竹喧归浣女，\n莲动下渔舟。\n随意春芳歇，\n王孙自可留。',
    annotation: '① 暝：日落，天将晚。② 喧：喧笑。③ 浣女：洗衣的女子。④ 王孙：原指贵族子弟，此处指作者自己。',
    translation: '空旷的山中刚下过一场新雨，傍晚时分天气显出秋意。明月透过松林洒下清光，清澈的泉水在石上流淌。竹林传来喧笑，是洗衣的姑娘归来；莲叶摇动，是渔舟正顺流而下。任凭春日的芳华消散，这秋日的山居仍值得留下一住。',
    appreciation: '王维的诗“诗中有画”，本诗便是一幅清新淡雅的山居秋景图。诗人捕捉“明月松间照，清泉石上流”的光影动响，又以“竹喧”“莲动”侧写人与活动，境幽意远。末句反用《楚辞》“王孙兮归来”，抒写归隐之志，超然物外。',
    emoji: '🏞️', bg: '#E4F5E8',
  },
  {
    title: '赋得古原草送别', authorId: 'bai-juyi', dynasty: '唐', genre: '五言律诗',
    content: '离离原上草，\n一岁一枯荣。\n野火烧不尽，\n春风吹又生。\n远芳侵古道，\n晴翠接荒城。\n又送王孙去，\n萋萋满别情。',
    annotation: '① 离离：繁茂的样子。② 枯荣：枯萎与茂盛。③ 远芳：远处的芳草。④ 萋萋：草木茂盛，此处指离别之情浓重。',
    translation: '原野上繁茂的野草，一年之中枯了又荣。野火烧也烧不尽它，春风一吹便又新生。远处的芳草蔓延到古道，晴日下的翠绿连接着荒城。如今又送别友人远行，那萋萋繁草正如我满心的离别之情。',
    appreciation: '诗题“赋得”，是一篇应试之作，却凭“野火烧不尽，春风吹又生”一句，写尽生命力的顽强与不屈，成为千古咏草绝唱。全诗以草起兴，由物及人，把野草的生生不息与送别的依依不舍绾合一体，立意高远而情味深长。',
    emoji: '🌿', bg: '#EAF6DC',
  },
  {
    title: '如梦令·昨夜雨疏风骤', authorId: 'li-qingzhao', workId: 'w-shuyu', dynasty: '宋', genre: '词',
    content: '昨夜雨疏风骤，\n浓睡不消残酒。\n试问卷帘人，\n却道海棠依旧。\n知否，知否？\n应是绿肥红瘦。',
    annotation: '① 雨疏风骤：雨点稀而风势急。② 浓睡：沉睡。③ 卷帘人：指侍女。④ 绿肥红瘦：叶茂盛而花凋零。',
    translation: '昨夜雨点稀落、风却刮得很急，我沉睡了一夜，也未能消去残存的酒意。试着问那卷帘的侍女，她只说海棠花还和从前一样。你可知道，你可知道？这时节的绿应是更肥，而红却已经瘦了。',
    appreciation: '这首小令只三十三字，却曲折有致。词人不直言惜花，而以“试问卷帘人”的细节，含蓄道出对春光流逝的敏感与怅惘。“绿肥红瘦”四字，以色彩与体量的比照写尽雨后海棠之态，新巧传神，是李清照“用浅俗之语，发清新之思”的典范。',
    emoji: '🌸', bg: '#FFE9F1',
  },
  {
    title: '水调歌头·明月几时有', authorId: 'su-shi', workId: 'w-dongpo', dynasty: '宋', genre: '词',
    content: '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。\n我欲乘风归去，又恐琼楼玉宇，高处不胜寒。\n起舞弄清影，何似在人间。\n转朱阁，低绮户，照无眠。\n不应有恨，何事长向别时圆？\n人有悲欢离合，月有阴晴圆缺，此事古难全。\n但愿人长久，千里共婵娟。',
    annotation: '① 把酒：端起酒杯。② 琼楼玉宇：指月中宫殿。③ 不胜寒：忍受不住寒冷。④ 婵娟：代指月亮。',
    translation: '明月是从什么时候开始有的？我端起酒杯遥问青天。不知道天上的宫殿，今夕是何年何月。我想要乘着长风飞回天上，又担心那美玉砌成的楼阁，高处太过寒冷。不如就在月下起舞，让月光清影随我徘徊，人间的美好又何尝逊于天上。月光转过朱红的楼阁，低低地照进雕花的窗户，照着我这无眠之人。月亮本不该有什么怨恨，为何总在人们离别时才这般圆满？人生有悲欢离合，月亮有阴晴圆缺，自古以来就难以两全。只愿亲人平安长久，纵然远隔千里，也能共赏这一轮明月，共寄思念。',
    appreciation: '这是中秋咏月的千古名篇。词人于丙辰中秋大醉，把酒问月，既有“乘风归去”的仙逸之想，又收束于“何似在人间”的旷达。下阕由月圆人不圆生出感慨，终于“但愿人长久，千里共婵娟”的深情祝福，超脱个人悲欢而臻于人间大爱，境界阔大、情味隽永。',
    emoji: '🌕', bg: '#E9E2FF',
  },
  {
    title: '饮酒·其五', authorId: 'tao-yuanming', dynasty: '东晋', genre: '五言古诗',
    content: '结庐在人境，\n而无车马喧。\n问君何能尔？\n心远地自偏。\n采菊东篱下，\n悠然见南山。\n山气日夕佳，\n飞鸟相与还。\n此中有真意，\n欲辨已忘言。',
    annotation: '① 结庐：建造房屋。② 人境：人间。③ 心远：心境高远。④ 辨：辨别、说破。',
    translation: '我搭屋居住在人来人往的世间，却没有车马的喧嚣。若问我为何能如此，只因心境高远，居处自然就僻静了。在东篱下采摘菊花，悠然不经意间望见南山。傍晚时分山间的气息愈发美好，飞鸟结伴而还。这其中有无法言说的真意，想把它说出来，却已忘了该用什么言辞。',
    appreciation: '陶渊明以“心远”二字点破“结庐人境而无车马喧”的玄机，揭示内心宁静才是超脱喧嚣的根本。“采菊东篱下，悠然见南山”，一个“见”字出于无心，物我两忘，正是王国维所谓“无我之境”。末句“此中有真意，欲辨已忘言”，把人生真趣归于不可言传之境，平淡而隽永。',
    emoji: '🌼', bg: '#FFF3D8',
  },
  {
    title: '杂感', authorId: 'huang-jingren', workId: 'w-liangdang', dynasty: '清', genre: '七言律诗',
    content: '仙佛茫茫两未成，\n只知独夜不平鸣。\n风蓬飘尽悲歌气，\n泥絮沾来薄幸名。\n十有九人堪白眼，\n百无一用是书生。\n莫因诗卷愁成谶，\n春鸟秋虫自作声。',
    annotation: '① 不平鸣：对不平之事发出不平之音。② 风蓬：随风飘飞的蓬草。③ 白眼：轻视、看不起。④ 谶：预言。',
    translation: '求仙访佛茫茫然皆无所成，只能在孤独的夜里为不平之事而鸣。如风吹蓬草，飘尽了一身的悲歌之气；如泥上沾絮，徒然落得个薄幸的虚名。十个里有九个都配受我的白眼，而百无一用、不被世所容的，正是我这书生。且莫因诗卷多愁便怕它成谶语，春鸟秋虫，自会发出属于自己的声音。',
    appreciation: '这首诗是黄景仁怀才不遇的自白。“百无一用是书生”一句，看似自嘲，实则为恃才傲物的孤愤、为世态炎凉的痛感。全诗以“不平鸣”为骨，风蓬、泥絮、白眼等意象层层递进，末句“春鸟秋虫自作声”又于绝望中横生倔强，写出了寒士在困顿中的铮铮傲骨。',
    emoji: '📜', bg: '#E9E4D8',
  },
  {
    title: '邹忌讽齐王纳谏（节选）', authorId: 'liu-xiang', workId: 'w-zhanguoce', dynasty: '西汉', genre: '文',
    content: '于是入朝见威王，\n曰：吾妻之美我者，私我也；\n妾之美我者，畏我也；\n客之美我者，欲有求于我也。',
    annotation: '① 美我：认为我美。② 私：偏爱。③ 畏：畏惧。④ 有求于我：对我有所求。',
    translation: '于是邹忌上朝拜见齐威王，说：我的妻子认为我美，是因为偏爱我；我的妾认为我美，是因为畏惧我；客人认为我美，是因为有求于我啊。',
    appreciation: '这是《战国策》中脍炙人口的一篇说理文字。邹忌以自身家事为喻，由生活小事上升到治国大道，巧妙劝谏齐王广开言路。语言层层推进、设喻贴切，是战国策士以浅显之喻谈深刻之理的典范，其“察纳雅言”的主张至今仍有现实意义。',
    emoji: '⚔️', bg: '#E9ECE3',
  },
  {
    title: '送杜少府之任蜀州', authorId: 'wang-bo', dynasty: '唐', genre: '五言律诗',
    content: '城阙辅三秦，\n风烟望五津。\n与君离别意，\n同是宦游人。\n海内存知己，\n天涯若比邻。\n无为在歧路，\n儿女共沾巾。',
    annotation: '① 城阙：都城长安。② 三秦：泛指关中之地。③ 五津：长江在蜀地的五个渡口，代指蜀地。④ 宦游：为官远游。',
    translation: '雄伟的长安城由三秦之地拱卫，遥望蜀地的风烟迷蒙，那便是五津一带了。与你分别，心中满是离情，只因我们同是奔波宦游之人。只要四海之内存有知己，纵隔天涯也如同近邻。不要在分手的岔路口，像小儿女般哭哭啼啼、泪湿衣巾。',
    appreciation: '离别的诗多凄恻，而王勃却豪迈旷达。“海内存知己，天涯若比邻”一扫离愁别绪，以广阔的胸怀舒展了离别的格局。全诗以“同是宦游人”自解自慰，又以“无为在歧路”劝勉友人，情感真挚而气象雄阔，是初唐五律中的名篇。',
    emoji: '🚢', bg: '#E2ECFF',
  },
  {
    title: '望庐山瀑布', authorId: 'li-bai', dynasty: '唐', genre: '七言绝句',
    content: '日照香炉生紫烟，\n遥看瀑布挂前川。\n飞流直下三千尺，\n疑是银河落九天。',
    annotation: '① 香炉：庐山香炉峰。② 遥看：远看。③ 三千尺：极言瀑布之高。④ 九天：天的最高处。',
    translation: '阳光照耀着香炉峰，升腾起紫色的云烟；远远看去，那瀑布像一条白练挂在山前的河川上。飞流直下，足有三千尺之高，仿佛是银河从九重天上倾落下来。',
    appreciation: '李白写景最善用夸张与想象。“飞流直下三千尺”以极度夸张写瀑布之壮观，“疑是银河落九天”更以瑰奇的想象把瀑布与天河接轨，气象万千、境界壮阔。一个“挂”字使瀑布如画悬山间，“疑”字则写出诗人目眩神摇的惊叹，尽显诗仙豪放飘逸之本色。',
    emoji: '💦', bg: '#DCF6F3',
  },
  {
    title: '离骚（节选）', authorId: 'qu-yuan', dynasty: '战国', genre: '骚体',
    content: '长太息以掩涕兮，\n哀民生之多艰。\n亦余心之所善兮，\n虽九死其犹未悔。\n路漫漫其修远兮，\n吾将上下而求索。',
    annotation: '① 太息：长长叹息。② 掩涕：擦拭眼泪。③ 所善：所追求的善。④ 九死：多次面临死亡。⑤ 求索：追寻探求。',
    translation: '我长长地叹息，掩面拭泪，哀叹人生的路途是多么艰难。只要是我心中所追求的美好理想，纵使九死一生，我也绝不后悔。前方的道路又漫长又悠远，我将上天下地，苦苦追寻那心中的真理。',
    appreciation: '屈原《离骚》是中国浪漫主义文学的源头。此段节选尽显诗人屈原“宁溘死以流亡兮，余不忍为此态”的坚守，“虽九死其犹未悔”道尽对理想的矢志不渝。“路漫漫其修远兮，吾将上下而求索”更成为千古传诵的励志名句，激励无数人在艰难困顿中执着前行。',
    emoji: '🌊', bg: '#E5ECFF',
  },
];

async function main() {
  // [SEED_DISABLED] 默认禁用：本库以真实语料(34万篇)为准，seed 手工数据已清除。
  // 如需重跑必须显式设置 RUN_SEED=1（会清空现有全部数据，谨慎！）
  if (process.env.RUN_SEED !== '1') {
    console.warn('[seed] 已禁用：数据库以真实语料为准，跳过手工 seed。');
    return;
  }

  const client = getSupabaseClient();

  // 清空旧数据（按依赖顺序，防止外键冲突）
  await client.from('reading_logs').delete().neq('id', '__never__');
  await client.from('relationships').delete().neq('id', '__never__');
  await client.from('poems').delete().neq('id', '__never__');
  await client.from('works').delete().neq('id', '__never__');
  await client.from('authors').delete().neq('id', '__never__');

  const insertAuthors = authors.map((a) => ({
    id: a.id, name: a.name, name_traditional: cn2tw(a.name),
    dynasty: a.dynasty, avatar_emoji: a.emoji, avatar_url: null, bio: a.bio,
  }));
  const { error: ae } = await client.from('authors').insert(insertAuthors);
  if (ae) throw new Error(`插入作者失败: ${ae.message}`);
  console.log(`作者 ${insertAuthors.length} 条`);

  const insertWorks = works.map((w) => ({
    id: w.id, name: w.name, author_id: w.authorId ?? null, era: w.era,
    description: w.description, cover_emoji: w.emoji,
  }));
  const { error: we } = await client.from('works').insert(insertWorks);
  if (we) throw new Error(`插入作品失败: ${we.message}`);
  console.log(`作品 ${insertWorks.length} 条`);

  const insertRels = relationships.map((r) => ({
    id: randomUUID(), author_id: r.a, related_author_id: r.b, relation: r.relation, note: r.note,
  }));
  const { error: re } = await client.from('relationships').insert(insertRels);
  if (re) throw new Error(`插入关系失败: ${re.message}`);
  console.log(`人际关系 ${insertRels.length} 条`);

  const insertPoems: any[] = [];
  for (const p of poems) {
    const built = buildContent(p.content);
    insertPoems.push({
      id: randomUUID(), title: p.title, author_id: p.authorId, work_id: p.workId ?? null,
      dynasty: p.dynasty, genre: p.genre,
      content: built.content, content_traditional: built.content_traditional,
      pinyin: built.pinyin, annotation: p.annotation, translation: p.translation,
      appreciation: p.appreciation, cover_emoji: p.emoji, background_hint: p.bg, read_count: 0,
    });
  }
  const { error: pe } = await client.from('poems').insert(insertPoems);
  if (pe) throw new Error(`插入诗文失败: ${pe.message}`);
  console.log(`诗文 ${insertPoems.length} 条`);

  console.log('== 种子数据写入完成 ==');
}

main().catch((e) => { console.error('种子写入出错:', e); process.exit(1); });