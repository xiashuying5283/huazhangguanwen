import { Api, hasBackend, type AuthorSummary, type Paged, type WorkSummary } from '@/utils/api';

const curated = [
  { name: '王维集', author: '王维', description: '选录王维山水田园、边塞与酬赠诗作。' },
  { name: '李白集', author: '李白', description: '李白诗作选读，品读行旅、咏怀与山水。' },
  { name: '杜甫集', author: '杜甫', description: '选录杜甫近体诗，读山河之变与行旅之思。' },
];

export async function loadWorks() {
  const works = await Api.get<WorkSummary[]>('/api/v1/works');
  if (!hasBackend) return works;
  const additions = await Promise.all(curated.filter(({ name, author }) =>
    !works.some((work) => work.name === name || work.author_name === author)
  ).map(async ({ name, author, description }): Promise<WorkSummary | null> => {
    const authors = await Api.get<Paged<AuthorSummary>>(`/api/v1/authors?q=${encodeURIComponent(author)}&limit=10`);
    const person = authors.list.find((item) => item.name === author && item.dynasty === '唐')
      ?? authors.list.find((item) => item.name === author);
    if (!person) return null;
    return { id: `author:${person.id}`, author_id: person.id, name, era: person.dynasty, description, author_name: person.name, poem_count: person.poem_count };
  }));
  return [...additions.filter((item) => item !== null), ...works];
}
