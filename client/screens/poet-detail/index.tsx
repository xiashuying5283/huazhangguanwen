import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { PoetPortrait } from '@/components/PoetPortrait';
import { PoemCard } from '@/components/PoemCard';
import { toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { loadPoet } from '@/data/people';
import { Api, hasBackend } from '@/utils/api';
import { theme } from '@/theme';

const tabs = ['生平年表', '代表作品', '评价'] as const;
type Tab = (typeof tabs)[number];

const liBaiTimeline = [
  ['701', '李白出生。'],
  ['742', '应召来到长安，供奉翰林。'],
  ['744', '离开长安，重启漫游。'],
  ['762', '卒于当涂。'],
] as const;

export default function PoetDetailScreen() {
  const router = useSafeRouter();
  const { id, tab: start } = useSafeSearchParams<{ id?: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(tabs.find((item) => item === start) ?? '生平年表');
  const load = useCallback(() => id ? loadPoet(id) : Promise.reject(new Error('缺少人物信息')), [id]);
  const result = useResource(load);
  const poet = result.data;
  const shelf = useReadingShelf();
  const saved = shelf.data.favorites.some((item) => item.kind === '人物' && item.item.id === id);
  const [generated, setGenerated] = useState<{ id: string; text: string }>();
  const [limit, setLimit] = useState(20);
  const bio = generated?.id === poet?.id ? generated?.text : poet?.bio;
  const needsBio = hasBackend && poet && !poet.bio?.trim();

  useEffect(() => {
    if (!needsBio || !id) return;
    let active = true;
    Api.post<{ bio?: string }>('/api/v1/ai/bio', { author_id: id }).then((data) => {
      if (active && data.bio) setGenerated({ id, text: data.bio });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [id, needsBio]);

  return (
    <Paper scene="people">
      <PageHeader title="人物小传" back centered>
        {poet && <IconButton icon={saved ? 'heart' : 'heart-outline'} label={saved ? '取消收藏人物' : '收藏人物'} color={saved ? theme.cinnabar : theme.ink} onPress={() => toggleFavorite({ kind: '人物', item: { id: poet.id, name: poet.name, dynasty: poet.dynasty } })} />}
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {result.loading && <ActivityIndicator color={theme.primary} />}
        {result.error && <Message retry={result.retry}>{result.error}</Message>}
        {poet && <>
          <PoetPortrait poet={poet} />
          <Pressable accessibilityRole="button" style={styles.relations} onPress={() => router.push('/relationships', { id: poet.id })}><Ink>查看人物关系 ›</Ink></Pressable>
          <Segments options={tabs} value={tab} onChange={setTab} />
          {tab === '生平年表' && <View style={[p.card, styles.panel]}>
            <Ink style={p.section}>{poet.name} · {poet.dynasty}</Ink>
            <Ink style={p.body}>{bio || '暂未收录生平资料'}</Ink>
            {poet.name === '李白' && <>
              <View style={styles.timeline}>
                {liBaiTimeline.map(([year, event]) => (
                  <View key={year} style={[p.row, p.divider, styles.yearRow]}>
                    <Ink style={styles.year}>{year}</Ink><Ink style={p.flex}>{event}</Ink>
                  </View>
                ))}
              </View>
              <Pressable accessibilityRole="link" style={styles.source} onPress={() => { void Linking.openURL('https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/20240708_PDF3.pdf').catch(() => undefined); }}>
                <Ink style={p.meta}>年表资料 · 香港教育局</Ink>
              </Pressable>
            </>}
          </View>}
          {tab === '评价' && <View style={[p.card, styles.panel]}>
            <Ink style={p.section}>诗文风格</Ink>
            <Ink style={p.body}>{poet.name === '李白' ? '李白诗歌想象瑰丽，语言自然明快。山水、饮酒与明月反复入诗，既写豪情，也写客居与离别。' : (bio || '暂未收录评价')}</Ink>
          </View>}
          {tab === '代表作品' && <View style={styles.works}>
            {poet.works.map((work) => (
              <Pressable key={work.id} style={[p.row, p.card, styles.work]} accessibilityRole="button" onPress={() => router.push('/work-detail', { id: work.id })}>
                <BookCover name={work.name} width={52} height={72} /><Ink style={p.itemTitle}>{work.name}</Ink>
              </Pressable>
            ))}
            {poet.poems.slice(0, limit).map((poem) => <PoemCard key={poem.id} poem={{ ...poem, author_name: poet.name }} />)}
            {poet.poems.length > limit && <Pressable accessibilityRole="button" style={styles.relations} onPress={() => setLimit(limit + 20)}><Ink>加载更多诗文</Ink></Pressable>}
            {!poet.works.length && !poet.poems.length && <Message>暂未收录作品</Message>}
          </View>}
        </>}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 17, marginTop: 14 },
  relations: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 11 },
  timeline: { marginTop: 14 },
  yearRow: { minHeight: 42 },
  year: { minWidth: 48, color: theme.primaryDeep },
  source: { alignSelf: 'flex-end', paddingVertical: 8 },
  works: { marginTop: 14 },
  work: { padding: 12, marginBottom: 10 },
});
