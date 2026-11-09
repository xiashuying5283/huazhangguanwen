export const art = {
  paper: require('@/assets/guanwen/backgrounds/paper_texture.png'),
  warm: require('@/assets/guanwen/backgrounds/warm_paper.png'),
  hills: require('@/assets/guanwen/scenes/hills-fade.png'),
  pines: require('@/assets/guanwen/backgrounds/mountains_pine.png'),
  plum: require('@/assets/guanwen/scenes/pink-plum.png'),
  moon: require('@/assets/guanwen/scenes/moon.png'),
  welcomeLake: require('@/assets/guanwen/scenes/pavilion-lake.png'),
  welcomePlum: require('@/assets/guanwen/scenes/splash-blossom.png'),
  daily: require('@/assets/guanwen/scenes/daily-landscape.png'),
  relationHills: require('@/assets/guanwen/scenes/relationship-mountains.png'),
  liBai: require('@/assets/guanwen/portraits/libai.png'),
  mist: require('@/assets/guanwen/circles/misty_mountains.png'),
  waterfall: require('@/assets/guanwen/circles/mountain_waterfall.png'),
  dusk: require('@/assets/guanwen/circles/sunset_river.png'),
  plumPavilion: require('@/assets/guanwen/circles/plum_pavilion.png'),
  winter: require('@/assets/guanwen/circles/winter_village.png'),
  boats: require('@/assets/guanwen/circles/sailing_boats.png'),
  bamboo: require('@/assets/guanwen/circles/bamboo_grove.png'),
};

const portraits: Record<string, number> = {
  李白: require('@/assets/guanwen/portraits/libai-avatar.png'),
  杜甫: require('@/assets/guanwen/portraits/dufu.png'),
  高适: require('@/assets/guanwen/portraits/gaoshi.png'),
  孟浩然: require('@/assets/guanwen/portraits/menghaoran.png'),
  王维: require('@/assets/guanwen/portraits/wangwei.png'),
  贺知章: require('@/assets/guanwen/portraits/hezhizhang.png'),
  岑参: require('@/assets/guanwen/portraits/censhen.png'),
};

export const portraitFor = (name: string) => portraits[name];

const covers: [RegExp, number][] = [
  [/王维|辋川/, require('@/assets/guanwen/book_covers/wangwei_collection.png')],
  [/李白|李太白/, require('@/assets/guanwen/book_covers/libai_collection.png')],
  [/杜甫|杜工部/, require('@/assets/guanwen/book_covers/dufu_collection.png')],
  [/苏轼|东坡/, require('@/assets/guanwen/book_covers/sushi_collection.png')],
  [/李商隐|李义山/, require('@/assets/guanwen/book_covers/lisangyin_collection.png')],
  [/全唐诗/, require('@/assets/guanwen/book_covers/complete_tang_poetry.png')],
];

export const coverFor = (name: string) => covers.find(([pattern]) => pattern.test(name))?.[1];

export function workType(name: string) {
  if (/全唐诗|全宋|总集|乐府诗集|诗经|楚辞/.test(name)) return '总集';
  if (/词|乐府/.test(name)) return '词集';
  if (/文集|战国策|古文|史记/.test(name)) return '文集';
  return '诗集';
}

export function poemArt(title: string) {
  if (/山居|山中/.test(title)) return art.mist;
  if (/饮酒|田园/.test(title)) return art.plumPavilion;
  if (/锦瑟|[月夜思]/.test(title)) return art.dusk;
  if (/塞|关|凉州/.test(title)) return art.winter;
  const choices = [art.mist, art.dusk, art.plumPavilion, art.waterfall, art.bamboo, art.boats];
  return choices[Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % choices.length];
}

export const topics = [
  { id: 'landscape', label: '山水', title: '山水田园', image: art.mist, banner: require('@/assets/guanwen/scenes/landscape_topic.png'), titles: ['山居秋暝', '饮酒', '望庐山瀑布', '鹿柴', '竹里馆', '过故人庄', '鸟鸣涧', '终南别业'] },
  { id: 'homesick', label: '思乡', title: '羁旅思乡', image: art.dusk, banner: require('@/assets/guanwen/scenes/homesick_river.png'), titles: ['静夜思', '九月九日忆山东兄弟', '次北固山下', '宿建德江', '月夜忆舍弟'] },
  { id: 'objects', label: '咏物', title: '咏物寄情', image: art.waterfall, banner: require('@/assets/guanwen/scenes/plum_sentiment.png'), titles: ['赋得古原草送别', '如梦令·昨夜雨疏风骤', '锦瑟', '咏柳', '梅花', '石灰吟'] },
  { id: 'frontier', label: '边塞', title: '边塞征战', image: art.winter, banner: require('@/assets/guanwen/scenes/frontier_wall.png'), titles: ['子夜吴歌·秋歌', '燕歌行', '出塞', '凉州词', '白雪歌送武判官归京', '使至塞上'] },
  { id: 'history', label: '怀古', title: '咏史怀古', image: art.bamboo, banner: require('@/assets/guanwen/scenes/ancient_history.png'), titles: ['蜀相', '春望', '赤壁', '乌衣巷', '念奴娇·赤壁怀古', '邹忌讽齐王纳谏'] },
];
