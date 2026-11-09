import { Api, type AuthorDetail, type AuthorSummary, type Paged, type Relationship } from '@/utils/api';

export const relatedNames = [
  { name: '杜甫', relation: '诗友' },
  { name: '高适', relation: '同游' },
  { name: '孟浩然', relation: '友人' },
  { name: '王维', relation: '同代' },
  { name: '贺知章', relation: '赏识' },
  { name: '岑参', relation: '同代' },
];

export async function findPoet(name: string) {
  const result = await Api.get<Paged<AuthorSummary>>(`/api/v1/authors?q=${encodeURIComponent(name)}&limit=12`);
  return result.list.find((item) => item.name === name && item.dynasty === '唐') ?? result.list.find((item) => item.name === name);
}

export async function loadPoet(id: string) {
  const poet = await Api.get<AuthorDetail>(`/api/v1/authors/${encodeURIComponent(id)}`);
  if (poet.name !== '李白') return poet;
  const found = await Promise.all(relatedNames.map(async ({ name, relation }): Promise<Relationship | undefined> => {
    const existing = poet.relationships.find((item) => item.related_author?.name === name);
    if (existing) return existing;
    const person = await findPoet(name).catch(() => undefined);
    return person ? { id: person.id, relation, related_author_id: person.id, related_author: person } : undefined;
  }));
  const remaining = poet.relationships.filter((item) => !found.some((entry) => entry?.id === item.id));
  return { ...poet, relationships: [...found.filter((item) => item !== undefined), ...remaining] };
}
