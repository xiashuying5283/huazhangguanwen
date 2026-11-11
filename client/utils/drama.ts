/**
 * 折子戏统一分发工具：识别杂剧折子（"书名・楔子 / 第X折"）并导航到作品概览页。
 * 供首页推荐、文库搜索、书架、收藏、最近阅读等所有入口复用，
 * 确保从任意入口点开一折都进入整部作品概览，而非普通单篇阅读。
 */

/** 判断标题是否为杂剧折子：形如 "书名・楔子" 或 "书名・第X折" */
export function isDramaTitle(title: string): boolean {
  return /・(?:楔子|第[一二三四五六七八九十百\d]+折)$/u.test(title);
}

/** 从折标题提取作品书名（去 "・楔子/第X折" 后缀） */
export function dramaBase(title: string): string {
  return title.replace(/・(?:楔子|第[一二三四五六七八九十百\d]+折)$/u, '');
}

/** 提取折名：形如 "㑳梅香騙翰林風月・楔子" → "楔子"；"第一折" → "第一折" */
export function actLabel(title: string): string {
  const m = title.match(/・(楔子|第[一二三四五六七八九十百\d]+折)$/u);
  return m ? m[1] : title;
}

/**
 * 根据诗文标题决定路由：
 * - 折子戏 → { path: '/drama', id }（整部作品的概览页）
 * - 普通诗文 → { path: '/read', id }
 */
export function routeForTitle(title: string, id: string): { path: 'drama' | 'read'; id: string } {
  return isDramaTitle(title) ? { path: 'drama', id } : { path: 'read', id };
}

/** 搜索结果中聚合后的剧作条目 */
export interface DramaHit {
  base: string;       // 剧名（去折后缀）
  firstId: string;    // 任选一折 id（进 /drama 概览页用，后端会均衡排序）
  actCount: number;   // 已收录折数
  author?: string | null;
}

/**
 * 把搜索结果/列表中的折子按剧名折叠为单条"剧作"，用于"搜剧名只出现一条作品"。
 * items 需含 id/title/author_name。
 */
export function collapseDramas<T extends { id: string; title: string; author_name?: string | null }>(
  items: T[],
): { dramas: DramaHit[]; poems: T[] } {
  const dramas: DramaHit[] = [];
  const poems: T[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (isDramaTitle(it.title)) {
      const base = dramaBase(it.title);
      if (seen.has(base)) continue;
      seen.add(base);
      const actCount = items.filter((x) => isDramaTitle(x.title) && dramaBase(x.title) === base).length;
      dramas.push({ base, firstId: it.id, actCount, author: it.author_name });
    } else {
      poems.push(it);
    }
  }
  return { dramas, poems };
}