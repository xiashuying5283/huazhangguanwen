import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { PaginationBar } from '@/components/PaginationBar';
import { PoetPortrait } from '@/components/PoetPortrait';
import { PoemCard } from '@/components/PoemCard';
import { toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { loadPoet } from '@/data/people';
import { Api, hasBackend, type Paged, type PoemSummary } from '@/utils/api';
import { theme } from '@/theme';

const tabs = ['生平年表', '代表作品', '评价'] as const;
type Tab = (typeof tabs)[number];

export default function PoetDetailScreen() {
  const { id } = useSafeSearchParams<{ id?: string }>();
  return <PoetDetail key={id} />;
}

function PoetDetail() {
  const router = useSafeRouter();
  const { id, tab: start } = useSafeSearchParams<{ id?: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(tabs.find((item) => item === start) ?? '生平年表');
  const load = useCallback(() => id ? loadPoet(id) : Promise.reject(new Error('缺少人物信息')), [id]);
  const result = useResource(load);
  const poet = result.data;
  const shelf = useReadingShelf();
  const saved = shelf.data.favorites.some((item) => item.kind === '人物' && item.item.id === id);
  const [generated, setGenerated] = useState<{ id: string; text: string }>();
  const [page, setPage] = useState(1);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [bioError, setBioError] = useState('');
  const loadPoems = useCallback(() => id && tab === '代表作品'
    ? Api.get<Paged<PoemSummary>>(`/api/v1/authors/${encodeURIComponent(id)}/poems?limit=40&offset=${(page - 1) * 40}`)
    : Promise.resolve(undefined), [id, tab, page]);
  const poems = useResource(loadPoems);
  const bio = generated?.id === poet?.id ? generated?.text : poet?.bio;
  const timeline = poet?.timeline ?? [];
  const needsBio = hasBackend && poet && !bio?.trim();

  const generateBio = async () => {
    if (!needsBio || !id || generatingBio) return;
    setGeneratingBio(true); setBioError('');
    try {
      const data = await Api.post<{ bio?: string }>('/api/v1/ai/bio', { author_id: id });
      if (data.bio) setGenerated({ id: poet.id, text: data.bio });
    } catch (reason) { setBioError(reason instanceof Error ? reason.message : '生成失败，请重试'); }
    finally { setGeneratingBio(false); }
  };

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
            {needsBio && <Pressable accessibilityRole="button" disabled={generatingBio} onPress={generateBio}><Ink>{generatingBio ? '生成中…' : '生成生平介绍'}</Ink></Pressable>}
            {!!bioError && <Message>{bioError}</Message>}
            {timeline.length > 0 && (
              <View style={styles.timeline}>
                {timeline.map(({ year, event }) => (
                  <View key={year} style={[p.row, p.divider, styles.yearRow]}>
                    <Ink style={styles.year}>{year}</Ink><Ink style={p.flex}>{event}</Ink>
                  </View>
                ))}
              </View>
            )}
            {poet.editorial_sources?.map(({ title, url }) => (
              <Pressable key={url} accessibilityRole="link" style={styles.source} onPress={() => { void Linking.openURL(url).catch(() => undefined); }}>
                <Ink style={p.meta}>{title}</Ink>
              </Pressable>
            ))}

          </View>}
          {tab === '评价' && <View style={[p.card, styles.panel]}>
            <Ink style={p.section}>诗文风格</Ink>
            <Ink style={p.body}>{poet.evaluation || '暂未收录评价'}</Ink>
          </View>}
          {tab === '代表作品' && <View style={styles.works}>
            {poet.works.map((work) => (
              <Pressable key={work.id} style={[p.row, p.card, styles.work]} accessibilityRole="button" onPress={() => router.push('/work-detail', { id: work.id })}>
                <BookCover name={work.name} width={52} height={72} /><Ink style={p.itemTitle}>{work.name}</Ink>
              </Pressable>
            ))}
            {poems.loading && <ActivityIndicator color={theme.primary} />}
            {poems.error && <Message retry={poems.retry}>{poems.error}</Message>}
            {poems.data?.list.map((poem) => <PoemCard key={poem.id} poem={{ ...poem, author_name: poet.name }} />)}
            {poems.data && poems.data.totalPages > 1 && <PaginationBar {...poems.data}
              onPrev={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} />}
            {poems.data?.total === 0 && !poet.works.length && <Message>暂未收录作品</Message>}
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
