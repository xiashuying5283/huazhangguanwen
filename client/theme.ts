/**
 * 观文 · 水墨国风主题 —— 宣纸墨毫的统一色彩令牌
 * 色板参考：墨绿 #355743 / 青绿 #5B7A6A / 米白 #F8F5EC /
 *           宣纸 #EFE7DA / 赭石 #B28A6A / 胭红 #C76B5B
 */
export const theme = {
  bgRoot: '#F7F3E9',      // 米白纸底
  bgSoft: '#F1EADA',
  surface: '#FFFDF6',     // 亮纸面（卡片）
  primary: '#355743',     // 墨绿主色
  primaryDeep: '#294733', // 深墨绿
  secondary: '#5B7A6A',   // 青绿
  mint: '#8FAE9A',        // 浅青绿
  sun: '#C9A54A',         // 淡金
  sky: '#8FA7B8',         // 远山青灰
  accent: '#B28A6A',      // 赭石
  cinnabar: '#C76B5B',    // 胭红（收藏/重点）
  ink: '#39463E',         // 墨
  inkSoft: '#617066',
  muted: '#8C968A',
  line: '#E4DBC6',
  shadowPrimary: 'rgba(53,87,67,0.18)',
  shadowSoft: 'rgba(53,87,67,0.10)',
};

export const SHADOW_PINK = {
  shadowColor: theme.shadowPrimary,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 18,
  shadowOpacity: 1,
  elevation: 6,
};

export const SHADOW_SOFT = {
  shadowColor: theme.shadowSoft,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 14,
  shadowOpacity: 1,
  elevation: 4,
};

/** 诗文卡片背景色池 —— 水墨淡彩（宣纸/青绿/赭米/淡胭等） */
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
  (hint && CARD_BG[hint]) ? CARD_BG[hint] : '#F2ECDD';