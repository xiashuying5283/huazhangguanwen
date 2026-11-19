import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, BookCover, IconButton, Ink, Message, PageHeader, Paper, Segments, paperStyles as p } from '@/components/Paper';
import { toggleFavorite, useReadingShelf } from '@/contexts/ReadingShelf';
import { poemArt } from '@/data/art';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { isDramaTitle } from '@/utils/drama';
import { theme } from '@/theme';

const tabs = ['诗文', '文集', '人物'] as const;
type Tab = (typeof tabs)[number];
const routes = { 诗文: '/read', 文集: '/work-detail', 人物: '/poet-detail' };

export default function FavoritesScreen() {
  const router = useSafeRouter();
  const { data, ready, storageError } = useReadingShelf();
  const [tab, setTab] = useState<Tab>('诗文');
  const [editing, setEditing] = useState(false);
  const items = data.favorites.filter((item) => item.kind === tab);

  return (
    <Paper tab>
      <PageHeader title="我的收藏" back fallback="/profile">
        <Pressable accessibilityRole="button" style={styles.edit} onPress={() => setEditing(!editing)}><Ink>{editing ? '完成' : '编辑'}</Ink></Pressable>
      </PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        <View style={p.card}><Segments options={tabs} value={tab} onChange={setTab} /></View>
        {storageError && <Message>当前无法读取或保存本机数据</Message>}
        {ready && items.length === 0 && <Message>还没有收藏{tab}</Message>}
        <View style={[p.card, styles.list]}>
          {items.map((favorite) => {
            const { item, kind } = favorite;
            const name = 'title' in item ? item.title : item.name;
            const byline = kind === '文集' ? [favorite.item.era, favorite.item.author_name] :
              kind === '诗文' ? [favorite.item.dynasty, favorite.item.author_name] : [favorite.item.dynasty];
            return <View key={item.id} style={[p.row, p.divider, styles.row]}>
              <Pressable accessibilityRole="button" style={[p.row, p.flex]} onPress={() => router.push(kind === '诗文' && isDramaTitle(name) ? '/drama' : routes[kind], { id: item.id })}>
                {kind === '诗文' && <Image source={poemArt(name)} style={styles.circle} />}
                {kind === '文集' && <BookCover name={name} width={58} height={78} />}
                {kind === '人物' && <Avatar name={name} size={78} />}
                <View style={p.flex}>
                  <Ink numberOfLines={2} style={p.itemTitle}>{name}</Ink>
                  <Ink style={p.meta}>{byline.filter(Boolean).join(' · ')}</Ink>
                </View>
              </Pressable>
              <IconButton icon={editing ? 'remove-circle-outline' : 'heart'} label={`移除收藏：${name}`} onPress={() => toggleFavorite(favorite)} color={theme.cinnabar} size={21} />
            </View>;
          })}
        </View>
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 13, paddingHorizontal: 9 },
  row: { minHeight: 112, paddingHorizontal: 3, gap: 5 },
  circle: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: '#fff7ec' },
  edit: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
});
