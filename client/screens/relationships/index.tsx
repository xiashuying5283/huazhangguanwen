import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Avatar, IconButton, Ink, Message, PageHeader, Paper } from '@/components/Paper';
import { PaperDialog } from '@/components/PaperDialog';
import { art } from '@/data/art';
import { loadPoet } from '@/data/people';
import { useResource } from '@/hooks/useResource';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { theme } from '@/theme';
import type { Relationship } from '@/utils/api';

type Point = { x: number; y: number };
type NodeDrag = { delta: Point; releasedAt?: number };
type Person = { key: string; name: string; id?: string | null; relations: string[]; notes: string[] };
const origin = { x: 0, y: 0 };
const edgeColors = ['#596648', '#785940', '#496469', '#795868'];
const clampZoom = (zoom: number) => Math.min(3, Math.max(0.65, zoom));

function dragOffset(drag: NodeDrag, now: number): Point {
  if (drag.releasedAt === undefined) return drag.delta;
  const seconds = Math.max(0, now - drag.releasedAt) / 1000;
  if (seconds > 2) return origin;
  const spring = Math.exp(-3.7 * seconds) * Math.cos(10 * seconds);
  return { x: drag.delta.x * spring, y: drag.delta.y * spring };
}

function relatedPeople(relationships: Relationship[]): Person[] {
  const people = new Map<string, Person>();
  for (const relationship of relationships) {
    const name = relationship.related_author?.name;
    if (!name) continue;
    const key = relationship.related_author_id || name;
    const person = people.get(key) ?? { key, name, id: relationship.related_author_id, relations: [], notes: [] };
    if (relationship.relation && !person.relations.includes(relationship.relation)) person.relations.push(relationship.relation);
    if (relationship.note && !person.notes.includes(relationship.note)) person.notes.push(relationship.note);
    people.set(key, person);
  }
  return [...people.values()];
}

export default function RelationshipsScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id?: string }>();
  const load = useCallback(() => id ? loadPoet(id) : Promise.reject(new Error('缺少人物信息')), [id]);
  const { data: poet, loading, error, retry } = useResource(load);
  const people = relatedPeople(poet?.relationships ?? []);

  return (
    <Paper scene="mountain">
      <PageHeader title="人物关系" back centered />
      <Image source={art.relationHills} style={styles.mountains} />
      {loading && <ActivityIndicator color={theme.primary} style={styles.loading} />}
      {error && <Message retry={retry}>{error}</Message>}
      {poet && people.length === 0 && <Message>{poet.name}暂未收录人物关系</Message>}
      {poet && people.length > 0 && <RelationshipGraph key={poet.id} name={poet.name} people={people}
        onOpen={(personId) => router.push('/poet-detail', { id: personId })} />}
    </Paper>
  );
}

function RelationshipGraph({ name, people, onOpen }: {
  name: string; people: Person[]; onOpen: (id: string) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState(origin);
  const [zoom, setZoom] = useState(1);
  const pinchBase = useRef(1);
  const [drags, setDrags] = useState<Record<string, NodeDrag>>({});
  const [start, setStart] = useState(() => performance.now());
  const [now, setNow] = useState(start);
  const reduceMotion = useReducedMotion();
  const [showNotes, setShowNotes] = useState(false);
  const peopleWithNotes = people.filter((person) => person.notes.length > 0);
  const radius = people.length * 13;
  const width = Math.max(size.width, 350, radius * 2 + 120);
  const height = Math.max(size.height, 420, radius * 2 + 130);
  const fit = Math.min(size.width / width, size.height / height);
  const scale = fit * zoom;
  const center = { x: width / 2, y: height / 2 };
  const hasLayout = fit > 0;

  useFocusEffect(useCallback(() => {
    if (reduceMotion || !hasLayout) return;
    let frame = 0;
    let previous = 0;
    const animate = (time: number) => {
      if (time - previous >= 30) {
        previous = time;
        setNow(time);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [hasLayout, reduceMotion]));

  const seconds = reduceMotion ? 0 : Math.max(0, now - start) / 1000;
  const spread = reduceMotion ? 1 : 1 - 0.7 * Math.exp(-4.2 * seconds) * Math.cos(8.7 * seconds);
  const float = reduceMotion ? 0 : Math.min(1, seconds);
  const offsets = new Map(Object.entries(drags).map(([key, drag]) => [key, dragOffset(drag, now)]));
  const pull = [...offsets.values()].reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), origin);
  const nodes = people.map((person, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / people.length;
    const phase = seconds * 1.9 + index * 1.3;
    const moved = offsets.get(person.key) ?? origin;
    const holding = drags[person.key] && drags[person.key].releasedAt === undefined;
    const drift = holding || reduceMotion ? 0 : 0.13;
    const point = {
      x: center.x + Math.cos(angle) * (width / 2 - 49) * spread
        + float * 9 * Math.sin(phase) + moved.x + drift * (pull.x - moved.x),
      y: center.y + Math.sin(angle) * Math.min(height / 2 - 55, Math.max(height * 0.29, radius)) * spread
        + float * 12 * Math.cos(phase * 0.9) + moved.y + drift * (pull.y - moved.y),
    };
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bow = float * (15 * Math.sin(phase) + Math.min(30, Math.hypot(moved.x, moved.y) * 0.18));
    const middle = { x: (center.x + point.x) / 2, y: (center.y + point.y) / 2 };
    const curve = { x: -dy * bow / distance, y: dx * bow / distance };
    const path = `M ${center.x} ${center.y} Q ${middle.x + curve.x} ${middle.y + curve.y} ${point.x} ${point.y}`;
    const label = { x: middle.x + curve.x / 2, y: middle.y + curve.y / 2 };
    return { person, point, path, label, color: edgeColors[index % edgeColors.length] };
  });

  const pan = Gesture.Pan().minDistance(6).maxPointers(1).runOnJS(true)
    .onChange(({ changeX, changeY }) => setOffset(({ x, y }) => ({ x: x + changeX, y: y + changeY })));
  const pinch = Gesture.Pinch().runOnJS(true)
    .onStart(() => { pinchBase.current = zoom; })
    .onUpdate(({ scale: pinchScale }) => setZoom(clampZoom(pinchBase.current * pinchScale)));

  return (
    <View style={styles.graph}>
      <GestureDetector gesture={pinch} touchAction="none">
        <View style={styles.canvas} onLayout={({ nativeEvent: { layout } }) => {
          setSize({ width: layout.width, height: layout.height });
        }}>
          <GestureDetector gesture={pan} touchAction="none">
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>
          {scale > 0 && <View pointerEvents="box-none" style={[styles.world, {
            width, height, left: (size.width - width) / 2, top: (size.height - height) / 2,
            transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }],
          }]}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              {nodes.map(({ person, path, color }) => (
                <Path key={person.key} d={path} fill="none" stroke={color} strokeWidth={1.2} />
              ))}
            </Svg>
            {nodes.map(({ person, label, color }) => (
              <View key={person.key} pointerEvents="none" style={[styles.edgeLabel, {
                left: label.x - 57, top: label.y - 11,
              }]}>
                <Ink style={[styles.edgeText, { color }]} numberOfLines={1}>{person.relations.join('、')}</Ink>
              </View>
            ))}
            <View pointerEvents="none" style={[styles.center, { left: center.x - 50, top: center.y - 43 }]}>
              <Avatar name={name} size={86} />
              <Ink style={styles.centerName}>{name}</Ink>
            </View>
            {nodes.map(({ person, point }) => (
              <PersonNode key={person.key} person={person} point={point} onOpen={onOpen} onMove={(dx, dy) => {
                setDrags((previous) => {
                  const drag = previous[person.key];
                  const current = drag ? dragOffset(drag, now) : origin;
                  return { ...previous, [person.key]: { delta: { x: current.x + dx / scale, y: current.y + dy / scale } } };
                });
              }} onRelease={() => {
                if (reduceMotion) return;
                const releasedAt = performance.now();
                setDrags((previous) => {
                  const drag = previous[person.key];
                  return drag ? { ...previous, [person.key]: { ...drag, releasedAt } } : previous;
                });
              }} />
            ))}
          </View>}
        </View>
      </GestureDetector>
      <View style={styles.toolbar}>
        <Ink style={styles.hint}>拖动头像或画布</Ink>
        {peopleWithNotes.length > 0 && <IconButton icon="chatbubble-ellipses-outline" label="关系说明" onPress={() => setShowNotes(true)} size={20} />}
        <IconButton icon="remove-outline" label="缩小关系图" onPress={() => setZoom((value) => clampZoom(value / 1.25))} size={20} />
        <IconButton icon="add-outline" label="放大关系图" onPress={() => setZoom((value) => clampZoom(value * 1.25))} size={20} />
        <IconButton icon="scan-outline" label="重置关系图" onPress={() => {
          setDrags({});
          setOffset(origin);
          setZoom(1);
          setStart(performance.now());
        }} size={20} />
      </View>
      {showNotes && <PaperDialog title="关系说明" onClose={() => setShowNotes(false)}>
        {peopleWithNotes.map((person) => (
          <View key={person.key} style={styles.note}>
            <Ink>{person.name} · {person.relations.join('、')}</Ink>
            <Ink style={styles.noteBody}>{person.notes.join('\n')}</Ink>
          </View>
        ))}
      </PaperDialog>}
    </View>
  );
}

function PersonNode({ person, point, onMove, onRelease, onOpen }: {
  person: Person; point: Point; onMove: (dx: number, dy: number) => void; onRelease: () => void; onOpen: (id: string) => void;
}) {
  const open = () => { if (person.id) onOpen(person.id); };
  const drag = Gesture.Pan().minDistance(6).maxPointers(1).runOnJS(true)
    .onChange(({ changeX, changeY }) => onMove(changeX, changeY))
    .onEnd(onRelease);
  const tap = Gesture.Tap().maxDistance(6).runOnJS(true)
    .onEnd((_event, success) => { if (success) open(); });

  return (
    <GestureDetector gesture={Gesture.Exclusive(drag, tap)} touchAction="none">
      <Pressable accessibilityRole="button" accessibilityLabel={[person.name, ...person.relations].join('，')}
        onAccessibilityTap={open}
        onPress={(event) => { if (Platform.OS === 'web' && 'detail' in event.nativeEvent && event.nativeEvent.detail === 0) open(); }}
        style={[styles.node, { left: point.x - 38, top: point.y - 29 }]}>
        <Avatar name={person.name} size={58} />
        <Ink style={styles.nodeName}>{person.name}</Ink>
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  mountains: { position: 'absolute', bottom: 0, width: '100%', height: 130, opacity: 0.65 },
  graph: { flex: 1, minHeight: 0, paddingHorizontal: 12, paddingBottom: 6 },
  canvas: { flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
  world: { position: 'absolute' },
  center: { position: 'absolute', width: 100, alignItems: 'center' },
  centerName: { fontSize: 23, marginTop: 3 },
  node: { position: 'absolute', width: 76, alignItems: 'center' },
  nodeName: { fontSize: 17, marginTop: 3, textAlign: 'center' },
  edgeLabel: { position: 'absolute', width: 114, height: 22, justifyContent: 'center', alignItems: 'center' },
  edgeText: { fontSize: 14, paddingHorizontal: 5, backgroundColor: theme.bgRoot, borderRadius: 6, maxWidth: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  hint: { flex: 1, color: theme.inkSoft, fontSize: 14 },
  note: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
  noteBody: { fontSize: 15, lineHeight: 24, color: theme.inkSoft, marginTop: 3 },
});
