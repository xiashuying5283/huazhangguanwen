import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ink, Segments, paperStyles } from '@/components/Paper';
import { theme } from '@/theme';

export const readingAnalysisTabs = ['注释', '译文', '赏析', '创作背景'] as const;
export type ReadingAnalysisTab = (typeof readingAnalysisTabs)[number];

export function ReadingAnalysis({ tab, onChange, children }: {
  tab: ReadingAnalysisTab;
  onChange: (tab: ReadingAnalysisTab) => void;
  children: ReactNode;
}) {
  return <View style={paperStyles.card}>
    <Segments options={readingAnalysisTabs} value={tab} onChange={onChange} />
    <View style={styles.content}>{children}</View>
  </View>;
}

export function AnalysisSection({ title, muted, children }: { title?: string; muted?: boolean; children: ReactNode }) {
  return <View>
    {title && <Ink style={styles.heading}>{title}</Ink>}
    <Ink style={[styles.text, muted && styles.muted]}>{children}</Ink>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 15, paddingTop: 12, gap: 12 },
  heading: { fontSize: 20, marginBottom: 5 },
  text: { fontSize: 17, lineHeight: 26 },
  muted: { color: theme.inkSoft, fontSize: 15 },
});
