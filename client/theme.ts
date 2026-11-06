/**
 * 甜奶油马卡龙主题 —— 可爱风格的统一色彩令牌
 */
export const theme = {
  bgRoot: '#FFF6F0',
  bgSoft: '#FFEFE7',
  surface: '#FFFFFF',
  primary: '#FF7E9C',
  primaryDeep: '#F05A7E',
  secondary: '#A78BFA',
  mint: '#5ED6B0',
  sun: '#FFC857',
  sky: '#7FB8FF',
  ink: '#6B4A52',
  inkSoft: '#8A6470',
  muted: '#B99AA0',
  line: '#FFE2DA',
  shadowPrimary: 'rgba(255,126,156,0.16)',
  shadowSoft: 'rgba(240,90,126,0.10)',
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

/** 诗文卡片背景色池 */
export const CARD_BG: Record<string, string> = {
  '#FFF1DC': '#FFF3DD',
  '#E8E3FF': '#EAE5FF',
  '#DCEFFF': '#E1F4FF',
  '#E4F5E8': '#E7F7EC',
  '#EAF6DC': '#EDF8E0',
  '#FFE9F1': '#FFECF3',
  '#E9E2FF': '#EDE7FF',
  '#FFF3D8': '#FFF5DC',
  '#E9E4D8': '#ECE7DC',
  '#E9ECE3': '#EEF0E7',
  '#E2ECFF': '#E6EEFF',
  '#DCF6F3': '#E1F8F5',
  '#E5ECFF': '#E9EFFF',
};

export const pickCardBg = (hint?: string | null): string =>
  (hint && CARD_BG[hint]) ? CARD_BG[hint] : '#FFF3E4';