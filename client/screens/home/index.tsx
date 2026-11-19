import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useResource } from '@/hooks/useResource';
import { IconButton, Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { SearchModal } from '@/components/SearchModal';
import { Api, hasBackend, type PoemDetail, type PoemSummary } from '@/utils/api';
import { art, poemArt, topics } from '@/data/art';
import { getDeviceId } from '@/utils/device';
import { routeForTitle } from '@/utils/drama';
import { theme } from '@/theme';

const homeTopics = [topics[0], topics[2], topics[1], topics[3]];

function dateLabel() {
  const date = new Date();
  const season = ['冬日', '春日', '夏日', '秋日'][Math.floor((date.getMonth() + 1) % 12 / 3)];
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    const digits = '一二三四五六七八九十';
    const dayName = day <= 10 ? `初${digits[day - 1]}` : day === 20 ? '二十' : day === 30 ? '三十'
      : `${day < 20 ? '十' : '廿'}${digits[day % 10 - 1]}`;
    const lunar = month && day ? `${month}${dayName}` : `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${lunar} · ${season}`;
  } catch {
    return `${date.getMonth() + 1}月${date.getDate()}日 · ${season}`;
  }
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const { width } = useWindowDimensions();
  const topicSize = Math.max(42, Math.min(69, (width - 54) / 5));
  const [searchOpen, setSearchOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const load = useCallback(async () => {
    const deviceId = hasBackend ? await getDeviceId() : 'local';
    const [daily, recommendations] = await Promise.all([
      Api.get<{ poem: PoemDetail }>(`/api/v1/recommend/daily?device_id=${encodeURIComponent(deviceId)}`),
      Api.get<PoemSummary[]>('/api/v1/recommend/list?limit=5').catch(() => []),
    ]);
    return { daily: daily.poem, recommendations };
  }, []);
  const { data, loading, error, retry } = useResource(load);
  const slides = data ? [data.daily, ...data.recommendations.filter((poem) => poem.id !== data.daily.id).slice(0, 3)] : [];
  const poem = slides[index] ?? slides[0];
  const read = (id: string, play = false) => {
    const title = [...slides, ...(data?.recommendations ?? [])].find((item) => item.id === id)?.title ?? '';
    const route = routeForTitle(title, id);
    router.push(route.path, { id, play });
  };

  return (
    <Paper tab>
      <PageHeader title="观文" caption={dateLabel()}>
        <IconButton icon="search-outline" label="搜索" onPress={() => setSearchOpen(true)} />
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.primary} style={styles.status} />}
        {error && <Message retry={retry}>{error}</Message>}
        {poem && <>
          <View style={styles.hero}>
            <Image source={art.warm} style={styles.heroPaper} />
            <View style={styles.illustration}>
              <Image source={index === 0 ? art.daily : poemArt(poem.title)} style={styles.illustrationImage} />
            </View>
            <Pressable style={styles.heroText} onPress={() => read(poem.id)} accessibilityRole="button" accessibilityLabel={`阅读${poem.title}`}>
              <Ink style={styles.kicker}>{index === 0 ? '今日荐诗' : '为你推荐'}</Ink>
              <Ink style={styles.poemTitle} numberOfLines={2}>{poem.title}</Ink>
              <Ink style={p.meta}>{poem.dynasty} · {poem.author_name ?? '佚名'}</Ink>
              {!!poem.content && <Ink style={styles.preview} numberOfLines={4}>{poem.content.split('\n').slice(0, 4).join('\n')}</Ink>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="播放朗读" onPress={() => read(poem.id, true)} style={styles.play}>
              <Ionicons name="play" size={21} color="#fff9ed" />
            </Pressable>
          </View>
          <View style={styles.dots}>
            {slides.map((item, i) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`切换到${item.title}`} accessibilityState={{ selected: i === index }}
                onPress={() => setIndex(i)} hitSlop={4} style={styles.dotTarget}>
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </>}
        <View style={styles.topics}>
          {homeTopics.map((topic) => (
            <Pressable key={topic.id} style={styles.topic} accessibilityRole="button" onPress={() => router.push('/explore', { topic: topic.id })}>
              <Image source={topic.image} style={[styles.topicImage, { width: topicSize, height: topicSize }]} />
              <Ink style={styles.topicText}>{topic.label}</Ink>
            </Pressable>
          ))}
        </View>
        <View style={styles.sectionHeading}>
          <Ink style={p.section}>为你推荐</Ink>
          <Pressable accessibilityRole="button" onPress={() => router.push('/explore')} hitSlop={8}>
            <Ink style={styles.more}>探索全部 ›</Ink>
          </Pressable>
        </View>
        <View style={p.card}>
          {data?.recommendations.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" style={[p.row, p.divider, styles.recommendation]} onPress={() => read(item.id)}>
              <Image source={poemArt(item.title)} style={styles.thumb} />
              <View style={p.flex}>
                <Ink numberOfLines={1} style={p.itemTitle}>{item.title}</Ink>
                <Ink style={p.meta}>{item.author_name ?? '佚名'} · {item.dynasty}</Ink>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.primary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </Paper>
  );
}

const styles = StyleSheet.create({
  status: { marginVertical: 42 },
  hero: { aspectRatio: 1.27, minHeight: 235, borderRadius: 18, overflow: 'hidden', backgroundColor: '#e8dcca' },
  heroPaper: { position: 'absolute', width: '100%', height: '100%' },
  illustration: { position: 'absolute', right: '-8%', top: '6%', width: '65%', aspectRatio: 1, borderWidth: 3, borderColor: '#fff7e7', borderRadius: 999, overflow: 'hidden' },
  illustrationImage: { width: '100%', height: '100%' },
  heroText: { width: '55%', minHeight: '100%', paddingHorizontal: 19, paddingVertical: 17, justifyContent: 'center' },
  kicker: { color: '#4e553f', letterSpacing: 2, marginBottom: 11 },
  poemTitle: { fontSize: 28, letterSpacing: 1, color: '#191e16' },
  preview: { marginTop: 12, fontSize: 17, lineHeight: 27, letterSpacing: 1.4 },
  play: { position: 'absolute', bottom: 9, right: 9, width: 43, height: 43, borderRadius: 23, backgroundColor: theme.primary, borderWidth: 1.5, borderColor: '#fff7e7', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', height: 32, alignItems: 'center' },
  dotTarget: { width: 15, height: 23, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, backgroundColor: '#b7ad9b', borderRadius: 4 },
  dotActive: { width: 7, height: 7, backgroundColor: theme.primary },
  topics: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 21 },
  topic: { alignItems: 'center', width: '21%', maxWidth: 80 },
  topicImage: { borderRadius: 999, borderWidth: 1, borderColor: '#fffaef' },
  topicText: { letterSpacing: 2, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 3 },
  more: { fontSize: 15, color: theme.primaryDeep },
  recommendation: { padding: 10, paddingHorizontal: 11 },
  thumb: { width: 72, height: 72, borderRadius: 36 },
});
