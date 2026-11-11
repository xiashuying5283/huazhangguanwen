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