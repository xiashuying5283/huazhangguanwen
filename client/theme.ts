/**
 * 观文 · 水墨国风主题 —— 严格对齐「观文 App」UI 素材包原型
 * 全局规范（来自原型截图）：
 *   背景 #F5F0E6（米杏宣纸） / 主色深橄榄绿 #5A6B45
 *   标题墨黑 #2A2A2A / 辅助浅灰 #888880
 *   投影 0 2px 8px rgba(0,0,0,0.04) / 圆角 16~20
 */
export const theme = {
  bgRoot: '#F5F0E6',     // 米杏宣纸底
  bgSoft: '#EFE7DA',
  surface: '#F8F3E9',    // 亮纸面（卡片/浅米色容器）
  primary: '#5A6B45',    // 深橄榄绿（选中态/主按钮/播放）
  primaryDeep: '#4A5A3A',// 更深橄榄
  secondary: '#5B7A6A',  // 青绿（辅）
  mint: '#A9B8A4',       // 浅青
  sun: '#C9A54A',        // 淡金
  sky: '#8FA7B8',        // 远山青灰
  accent: '#B28A6A',     // 赭石
  cinnabar: '#C76B5B',   // 砖红（收藏）
  ink: '#2A2A2A',        // 墨黑
  inkSoft: '#777770',    // 注释浅灰
  muted: '#888880',      // 辅助浅灰
  line: '#E4DBC6',
  shadowPrimary: 'rgba(0,0,0,0.06)',
  shadowSoft: 'rgba(0,0,0,0.04)',
};

/** 极淡纸张投影：0 2~4px, rgba(0,0,0,0.04~0.06) */
export const SHADOW_PINK = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  shadowOpacity: 0.06,
  elevation: 2,
};

export const SHADOW_SOFT = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 6,
  shadowOpacity: 0.04,
  elevation: 2,
};

/** 诗文卡片背景色池 —— 低饱和莫兰迪国风淡彩 */
export const CARD_BG: Record<string, string> = {
  '#F1EADA': '#F3EDDE',   // 宣纸
  '#E4ECE2': '#E7EFE5',   // 淡青
  '#F0E5D8': '#F2E8DC',   // 赭米
  '#E6E1D2': '#EAE5D7',   // 秋宣
  '#DFE9E6': '#E3EDEA',   // 青灰
  '#F2DFD6': '#F4E3DB',   // 淡胭
  '#E9E2D6': '#EDE7DC',   // 竹纸
  '#E5E7DC': '#E9EBE1',   // 苔绿
  '#EFE8DC': '#F2ECE1',   // 米宣
  '#DEE6DF': '#E3E9E3',   // 水青
};

export const pickCardBg = (hint?: string | null): string =>
  (hint && CARD_BG[hint]) ? CARD_BG[hint] : '#F4EFE4';