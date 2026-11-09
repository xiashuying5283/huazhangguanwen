import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { AuthorSummary, PoemSummary, WorkSummary } from '@/utils/api';

type Favorite =
  | { kind: '诗文'; item: PoemSummary }
  | { kind: '文集'; item: WorkSummary }
  | { kind: '人物'; item: AuthorSummary };

export type ReadingPreferences = {
  pinyin: boolean;
  traditional: boolean;
  fontSize: number;
  paper: '宣纸' | '暖笺';
};

type Shelf = {
  welcomed: boolean;
  favorites: Favorite[];
  notes: { poem: PoemSummary; text: string }[];
  history: PoemSummary[];
  readingDays: string[];
  preferences: ReadingPreferences;
};

const STORAGE_KEY = 'guanwen_reading_shelf_v1';
const defaults: Shelf = {
  welcomed: false, favorites: [], notes: [], history: [], readingDays: [],
  preferences: { pinyin: false, traditional: false, fontSize: 23, paper: '宣纸' },
};
let snapshot = { data: defaults, ready: false, storageError: false };
let hydration: Promise<void> | undefined;
let writes = Promise.resolve();
const listeners = new Set<() => void>();

function publish(value: typeof snapshot) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}

function hydrate() {
  hydration ??= AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
    const saved = raw ? JSON.parse(raw) as Partial<Shelf> : {};
    publish({ ready: true, storageError: false, data: { ...defaults, ...saved, preferences: { ...defaults.preferences, ...saved.preferences } } });
  }).catch(() => publish({ ...snapshot, ready: true, storageError: true }));
  return hydration;
}

function update(change: (data: Shelf) => Shelf) {
  void hydrate().then(() => {
    const data = change(snapshot.data);
    publish({ ...snapshot, data });
    writes = writes.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)))
      .then(() => {
        if (snapshot.storageError) publish({ ...snapshot, storageError: false });
      })
      .catch(() => publish({ ...snapshot, storageError: true }));
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => snapshot;

export function useReadingShelf() {
  useEffect(() => { void hydrate(); }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function dismissWelcome() {
  update((data) => ({ ...data, welcomed: true }));
}

export function toggleFavorite(favorite: Favorite) {
  update((data) => {
    const keep = data.favorites.filter(({ kind, item }) => kind !== favorite.kind || item.id !== favorite.item.id);
    return { ...data, favorites: keep.length === data.favorites.length ? [favorite, ...keep] : keep };
  });
}

export function recordRead(poem: PoemSummary) {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  update((data) => ({
    ...data,
    history: [poem, ...data.history.filter(({ id }) => id !== poem.id)].slice(0, 100),
    readingDays: Array.from(new Set([...data.readingDays, day])),
  }));
}

export function setNote(poem: PoemSummary, text: string) {
  update((data) => {
    const rest = data.notes.filter((note) => note.poem.id !== poem.id);
    return { ...data, notes: text.trim() ? [{ poem, text: text.trim() }, ...rest] : rest };
  });
}

export function setPreferences(preferences: Partial<ReadingPreferences>) {
  update((data) => ({ ...data, preferences: { ...data.preferences, ...preferences } }));
}
