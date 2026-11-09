import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AuthorCard } from '@/components/AuthorCard';
import { Avatar, IconButton, Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { PoetActions, PoetPortrait } from '@/components/PoetPortrait';
import { SearchModal } from '@/components/SearchModal';
import { PaginationBar } from '@/components/PaginationBar';
import { findPoet, loadPoet } from '@/data/people';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Api, type AuthorSummary, type Paged } from '@/utils/api';
import { theme } from '@/theme';

async function loadFeatured() {
  const person = await findPoet('李白');
  if (person) return loadPoet(person.id);
  const authors = await Api.get<Paged<AuthorSummary>>('/api/v1/authors?limit=1');
  return authors.list[0] ? loadPoet(authors.list[0].id) : undefined;
}

export default function PoetsScreen() {
  const router = useSafeRouter();
  const [search, setSearch] = useState(false);
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const featured = useResource(loadFeatured);
  const loadAll = useCallback(() => all ? Api.get<Paged<AuthorSummary>>(`/api/v1/authors?limit=18&offset=${(page - 1) * 18}`) : Promise.resolve(undefined), [all, page]);
  const people = useResource(loadAll);
  const poet = featured.data;
  const openPoet = (id: string, tab?: string) => router.push('/poet-detail', { id, tab });

  return (
    <Paper tab scene="people">
      <PageHeader title="人物"><IconButton icon="search-outline" label="搜索人物" onPress={() => setSearch(true)} /></PageHeader>
      <ScrollView style={p.scroll} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
        {featured.loading && <ActivityIndicator color={theme.primary} style={styles.status} />}
        {featured.error && <Message retry={featured.retry}>{featured.error}</Message>}
        {poet && <>
          <PoetPortrait poet={poet} onPress={() => openPoet(poet.id)} />
          <PoetActions onSelect={(action) => action === '人物关系' ? router.push('/relationships', { id: poet.id }) : openPoet(poet.id, action)} />
          <Ink style={p.section}>相关人物</Ink>
          <View style={styles.related}>
            {poet.relationships.slice(0, 4).map((item) => {
              const name = item.related_author?.name ?? '佚名';
              return <Pressable key={item.id} accessibilityRole="button" disabled={!item.related_author_id} style={styles.person} onPress={() => item.related_author_id && openPoet(item.related_author_id)}>
                <Avatar name={name} size={62} /><Ink style={styles.name}>{name}</Ink>
              </Pressable>;
            })}
          </View>
        </>}
        <Pressable accessibilityRole="button" onPress={() => setAll(!all)} style={styles.all}>
          <Ink style={{ color: theme.primaryDeep }}>{all ? '收起人物列表' : '查看全部人物 ›'}</Ink>
        </Pressable>
        {all && <>
          {people.loading && <ActivityIndicator color={theme.primary} />}
          {people.error && <Message retry={people.retry}>{people.error}</Message>}
          {people.data?.list.map((item) => <AuthorCard key={item.id} author={item} />)}
          {people.data && people.data.totalPages > 1 && <PaginationBar {...people.data} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />}
        </>}
      </ScrollView>
      <SearchModal visible={search} onClose={() => setSearch(false)} />
    </Paper>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: 32 },
  related: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, paddingHorizontal: 6 },
  person: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 4 },
  name: { fontSize: 17, textAlign: 'center' },
  all: { alignSelf: 'flex-end', paddingVertical: 15, paddingHorizontal: 5 },
});
