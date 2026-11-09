import { useCallback, useEffect, useState } from 'react';

export function useResource<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<{ load: () => Promise<T>; data?: T; error?: string; revision: number }>();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => { if (active) setResult({ load, data, revision }); },
      (error: unknown) => { if (active) setResult({ load, error: error instanceof Error ? error.message : '加载失败', revision }); },
    );
    return () => { active = false; };
  }, [load, revision]);

  if (result?.load !== load || result.revision !== revision) return { data: undefined, error: undefined, loading: true, retry };
  return { data: result.data, error: result.error, loading: false, retry };
}
