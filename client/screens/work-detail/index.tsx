import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { PaginationBar } from '@/components/PaginationBar';
import { toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { workType } from '@/data/art';
import { loadWorks } from '@/data/works';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Api, hasBackend, type Paged, type PoemSummary } from '@/utils/api';
import { shareText } from '@/utils/share';
import { theme } from '@/theme';

const tabs = ['简介', '目录', '版本', '相关'] as const;
const genreOrder = ['五言古诗', '五言绝句', '五言律诗', '七言绝句', '七言律诗'];
const volumeLabels = '一二三四五六七八九十';

export default function WorkDetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const [tab, setTab] = useState<(typeof tabs)[number]>('目录');
  const [open, setOpen] = useState<string>();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const shelf = useReadingShelf();
  const catalog = useResource(loadWorks);
  const work = catalog.data?.find((item) => item.id === id);
  const authorCollection = id?.startsWith('author:');
  const loadPoems = useCallback(() => id ? Api.get<Paged<PoemSummary>>(
    `/api/v1/poems?${authorCollection ? 'author_id' : 'work_id'}=${encodeURIComponent(authorCollection ? id.slice(7) : id)}&limit=40&offset=${(page - 1) * 40}`
  ) : Promise.resolve(undefined), [id, page, authorCollection]);
  const poems = useResource(loadPoems);
  const groups = new Map<string, PoemSummary[]>();
  for (const poem of poems.data?.list ?? []) {
    const genre = poem.genre || '诗文';
    groups.set(genre, [...(groups.get(genre) ?? []), poem]);
  }
  const ordered = Array.from(groups.keys()).sort((a, b) =>
    (genreOrder.indexOf(a) + genreOrder.length + 1) % (genreOrder.length + 1) -
    (genreOrder.indexOf(b) + genreOrder.length + 1) % (genreOrder.length + 1));
  const favorite = shelf.data.favorites.some((item) => item.kind === '文集' && item.item.id === id);

  return (
    <Paper scene="mountain">
      <PageHeader back>
        {work && <>
          <IconButton icon={favorite ? 'heart' : 'heart-outline'} label={favorite ? '取消收藏文集' : '收藏文集'} color={favorite ? theme.cinnabar : theme.ink} onPress={() => toggleFavorite({ kind: '文集', item: work })} />
          <IconButton icon="share-outline" label="分享文集" onPress={async () => {
            try { setNotice(await shareText(work.name, [work.name, work.author_name, work.description].filter(Boolean).join('\n')) ?? ''); }
            catch (reason) { if ((reason as Error).name !== 'AbortError') setNotice('当前无法分享'); }
          }} />
        </>}
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {catalog.loading && <ActivityIndicator color={theme.primary} />}
        {catalog.error && <Message retry={catalog.retry}>{catalog.error}</Message>}
        {catalog.data && !work && <Message>未找到这本文集</Message>}
        {work && <>
          <View style={[p.row, styles.hero]}>
            <BookCover name={work.name} width={123} height={166} />
            <View style={p.flex}>
              <Ink style={styles.title}>{work.name}</Ink>
              <Ink style={p.meta}>{[work.era, work.author_name].filter(Boolean).join(' · ')}</Ink>
              <View style={styles.tags}>
                {[workType(work.name), ...(work.name === '王维集' ? ['田园', '山水'] : [])].map((tag) => <Ink key={tag} style={styles.tag}>{tag}</Ink>)}
              </View>
            </View>
          </View>
          <Ink style={[p.body, styles.summary]}>{work.description ?? '翻开文集，按篇阅读。'}</Ink>
          {!!notice && <Message>{notice}</Message>}
          <View style={p.card}><Segments options={tabs} value={tab} onChange={setTab} /></View>
          {tab === '目录' && <View style={[p.card, styles.panel]}>
            {poems.loading && <ActivityIndicator color={theme.primary} />}
            {poems.error && <Message retry={poems.retry}>{poems.error}</Message>}
            {poems.data?.list.length === 0 && <Message>暂未收录篇目</Message>}
            {ordered.map((genre, index) => (
              <View key={genre} style={p.divider}>
                <Pressable style={[p.row, styles.volume]} accessibilityRole="button" accessibilityState={{ expanded: open === genre }} onPress={() => setOpen(open === genre ? undefined : genre)}>
                  <Ink style={styles.volumeLabel}>{`卷${volumeLabels[index] ?? index + 1}`}</Ink>
                  <Ink style={[p.flex, styles.volumeLabel]}>{genre}</Ink>
                  <Ionicons name={open === genre ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.primary} />
                </Pressable>
                {open === genre && groups.get(genre)?.map((poem) => (
                  <Pressable key={poem.id} accessibilityRole="button" style={[p.row, styles.poem]} onPress={() => router.push('/read', { id: poem.id })}>
                    <Ink style={p.flex}>{poem.title}</Ink>
                    <Ionicons name="chevron-forward-outline" size={16} color={theme.primary} />
                  </Pressable>
                ))}
              </View>
            ))}
            {poems.data && poems.data.totalPages > 1 && <PaginationBar {...poems.data} onPrev={() => { setOpen(undefined); setPage(page - 1); }} onNext={() => { setOpen(undefined); setPage(page + 1); }} />}
          </View>}
          {tab === '简介' && <View style={[p.card, styles.textPanel]}><Ink style={p.body}>{work.description || work.name}{'\n'}收录篇目 {work.poem_count ?? poems.data?.total ?? '—'} 篇</Ink></View>}
          {tab === '版本' && <View style={[p.card, styles.textPanel]}><Ink style={p.body}>{hasBackend ? '文本来源为观文文库。' : '文本来源为观文内置选篇。'}目录按本页收录诗文的体裁分组。</Ink></View>}
          {tab === '相关' && <View style={[p.card, styles.panel]}>
            {work.author_id && <Pressable style={styles.volume} accessibilityRole="button" onPress={() => router.push('/poet-detail', { id: work.author_id })}><Ink>查看人物 · {work.author_name}</Ink></Pressable>}
            {catalog.data?.filter((item) => item.id !== id && workType(item.name) === workType(work.name)).slice(0, 4).map((item) => (
              <Pressable key={item.id} style={[styles.volume, p.divider]} accessibilityRole="button" onPress={() => router.push('/work-detail', { id: item.id })}><Ink>{item.name}</Ink></Pressable>
            ))}
          </View>}
        </>}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 13, paddingTop: 11, gap: 20 },
  title: { fontSize: 32, letterSpacing: 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, fontSize: 14, borderColor: theme.line, borderWidth: 1, borderRadius: 9 },
  summary: { marginTop: 16, marginBottom: 18, marginHorizontal: 10, letterSpacing: 1 },
  panel: { paddingHorizontal: 15, marginTop: 14 },
  textPanel: { padding: 15, marginTop: 14 },
  volume: { minHeight: 57, justifyContent: 'center' },
  volumeLabel: { fontSize: 20 },
  poem: { paddingLeft: 19, minHeight: 44 },
});
