import { useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, type DimensionValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Avatar, Ink, Message, PageHeader, Paper, paperStyles as p } from '@/components/Paper';
import { art } from '@/data/art';
import { loadPoet } from '@/data/people';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { theme } from '@/theme';

const positions = [[24, 12], [76, 12], [11, 48], [89, 48], [24, 84], [76, 84]];
const pct = (n: number): DimensionValue => `${n}%`;

export default function RelationshipsScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const load = useCallback(() => id ? loadPoet(id) : Promise.reject(new Error('缺少人物信息')), [id]);
  const { data: poet, loading, error, retry } = useResource(load);
  const relationships = poet?.relationships.filter((item) => item.related_author?.name) ?? [];
  const primary = relationships.slice(0, positions.length);

  return (
    <Paper scene="mountain">
      <PageHeader title="人物关系" back centered />
      <Image source={art.relationHills} style={styles.mountains} />
      <ScrollView style={p.scroll} contentContainerStyle={[p.content, styles.content]} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={theme.primary} />}
        {error && <Message retry={retry}>{error}</Message>}
        {poet && !primary.length && <Message>{poet.name}暂未收录人物关系</Message>}
        {poet && primary.length > 0 && <View style={styles.graph}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
            {primary.map((relation, index) => {
              const [x, y] = positions[index];
              return <Path key={relation.id} d={`M 50 48 Q ${x} ${48 + (y - 48) * 0.6} ${x} ${y}`} fill="none" stroke="#b6a887" strokeWidth={0.3} />;
            })}
          </Svg>
          <View style={styles.center}>
            <Avatar name={poet.name} size={124} /><Ink style={styles.centerName}>{poet.name}</Ink>
          </View>
          {primary.map((item, index) => {
            const [x, y] = positions[index];
            const name = item.related_author?.name ?? '';
            return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${name}，${item.relation}`} disabled={!item.related_author_id}
              onPress={() => item.related_author_id && router.push('/poet-detail', { id: item.related_author_id })}
              style={[styles.node, { left: pct(x), top: pct(y) }]}>
              <Avatar name={name} size={61} />
              <Ink style={styles.nodeName}>{name}</Ink><Ink style={styles.relation}>{item.relation}</Ink>
            </Pressable>;
          })}
        </View>}
        {relationships.slice(positions.length).map((item) => (
          <Pressable key={item.id} accessibilityRole="button" disabled={!item.related_author_id} style={[p.row, p.card, styles.extra]} onPress={() => router.push('/poet-detail', { id: item.related_author_id })}>
            <Avatar name={item.related_author?.name ?? ''} size={46} />
            <View style={p.flex}><Ink>{item.related_author?.name} · {item.relation}</Ink>{item.note && <Ink style={p.meta}>{item.note}</Ink>}</View>
          </Pressable>
        ))}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 80 },
  mountains: { position: 'absolute', bottom: 0, width: '100%', height: 130, opacity: 0.75 },
  graph: { height: 470, marginHorizontal: 5, marginTop: 10 },
  center: { position: 'absolute', left: '50%', top: '48%', width: 128, marginLeft: -64, marginTop: -61, alignItems: 'center' },
  centerName: { fontSize: 24, marginTop: 4 },
  node: { position: 'absolute', width: 82, marginLeft: -41, marginTop: -30, alignItems: 'center' },
  nodeName: { fontSize: 18, marginTop: 2 },
  relation: { fontSize: 15, color: theme.inkSoft },
  extra: { padding: 12, marginBottom: 8 },
});
