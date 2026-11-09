import { useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useResource } from '@/hooks/useResource';
import { Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { PoemCard } from '@/components/PoemCard';
import { topics } from '@/data/art';
import { Api, type Paged, type PoemSummary } from '@/utils/api';
import { theme } from '@/theme';

export default function ExploreScreen() {
  const router = useSafeRouter();
  const { topic: id } = useSafeSearchParams<{ topic?: string }>();
  const topic = topics.find((item) => item.id === id);
  const load = useCallback(async () => {
    if (!topic) return [];
    const results = await Promise.all(topic.titles.map((title) =>
      Api.get<Paged<PoemSummary>>(`/api/v1/poems?q=${encodeURIComponent(title)}&limit=3`)));
    return Array.from(new Map(results.flatMap((page) => page.list).map((poem) => [poem.id, poem])).values());
  }, [topic]);
  const { data, loading, error, retry } = useResource(load);

  return (
    <Paper>
      <PageHeader title={topic?.title ?? '探索'} back centered={!!topic} />
      <ScrollView style={p.scroll} contentContainerStyle={[p.content, styles.content]} showsVerticalScrollIndicator={false}>
        {!topic ? topics.map((item) => (
          <Pressable key={item.id} style={styles.banner} accessibilityRole="button" onPress={() => router.push('/explore', { topic: item.id })}>
            <BannerArt source={item.banner} />
            <Ink style={styles.bannerTitle}>{item.title}</Ink>
          </Pressable>
        )) : <>
          <View style={styles.banner}><BannerArt source={topic.banner} /></View>
          {loading && <ActivityIndicator color={theme.primary} />}
          {error && <Message retry={retry}>{error}</Message>}
          {data?.length === 0 && <Message>这一主题暂未收录诗文</Message>}
          {data?.map((poem) => <PoemCard key={poem.id} poem={poem} />)}
        </>}
      </ScrollView>
    </Paper>
  );
}

function BannerArt({ source }: { source: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={source} style={styles.image} />
      <LinearGradient colors={['#eee2d2', '#eee2d2c0', '#eee2d200']} start={{ x: 0.16, y: 0 }} end={{ x: 0.63, y: 0 }} style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 13 },
  banner: { minHeight: 78, justifyContent: 'center', paddingHorizontal: 21, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eee2d2', marginBottom: 14 },
  image: { position: 'absolute', width: '77%', height: '100%', right: 0 },
  bannerTitle: { fontSize: 26, letterSpacing: 3, color: '#161c16' },
});
