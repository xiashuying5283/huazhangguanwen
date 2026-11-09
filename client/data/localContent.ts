import corpus from '@/data/selected-readings.json';
import type { AuthorDetail, PoemDetail } from '@/utils/api';

const { authors, works, relationships } = corpus;
const poems: PoemDetail[] = corpus.poems;
const daily = poems.find((poem) => poem.title === '山居秋暝')!;
const recommended = ['饮酒（其五）', '锦瑟', '静夜思', '鹿柴', '蜀相']
  .map((title) => poems.find((poem) => poem.title === title)!);

export function localCreationBackground(poem: PoemDetail) {
  return poems.find((entry) => entry.title === poem.title && entry.author_name === poem.author_name)?.creation_background;
}

function paginate<T>(list: T[], params: URLSearchParams) {
  const pageSize = Math.max(1, Math.min(60, Number(params.get('limit')) || 30));
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  return { list: list.slice(offset, offset + pageSize), page: Math.floor(offset / pageSize) + 1, pageSize, total: list.length, totalPages: Math.ceil(list.length / pageSize) };
}

function getAuthor(id: string): AuthorDetail {
  const author = authors.find((item) => item.id === id);
  if (!author) throw new Error('未找到该人物');
  return {
    ...author,
    works: works.filter((work) => work.author_id === id),
    poems: poems.filter((poem) => poem.author_id === id),
    relationships: relationships.filter((relation) => relation.a === id).map((relation) => ({
      id: `${id}-${relation.b}`,
      relation: relation.relation,
      note: relation.note,
      related_author_id: relation.b,
      related_author: authors.find((person) => person.id === relation.b),
    })),
  };
}

export function getLocalContent(path: string): unknown {
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const q = params.get('q')?.trim() ?? '';
  const matches = (value: string) => value.includes(q);
  if (route === '/api/v1/recommend/daily') return { poem: daily };
  if (route === '/api/v1/recommend/list') return recommended.slice(0, Number(params.get('limit')) || 5);
  if (route === '/api/v1/works') return works;
  if (route === '/api/v1/authors') return paginate(authors.filter((author) => matches(author.name)), params);
  if (route.startsWith('/api/v1/authors/')) return getAuthor(decodeURIComponent(route.slice('/api/v1/authors/'.length)));
  if (route === '/api/v1/poems') {
    const work = params.get('work_id');
    const author = params.get('author_id');
    return paginate(poems.filter((poem) => (!work || poem.work_id === work) && (!author || poem.author_id === author) && matches(poem.title)), params);
  }
  if (route.startsWith('/api/v1/poems/')) {
    const poem = poems.find((item) => item.id === decodeURIComponent(route.slice('/api/v1/poems/'.length)));
    if (!poem) throw new Error('未找到该篇诗文');
    return poem;
  }
  if (route === '/api/v1/search') return {
    authors: authors.filter((author) => matches(author.name)),
    works: works.filter((work) => matches(work.name)),
    poems: poems.filter((poem) => matches(poem.title) || matches(poem.content)),
  };
  if (route === '/api/v1/history') return { ...paginate([], params), read_count: 0, author_count: 0 };
  throw new Error('内置选篇没有该内容');
}
