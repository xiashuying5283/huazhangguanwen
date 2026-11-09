import { Platform, Share } from 'react-native';

export async function shareText(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text: message });
      return '已分享';
    }
    if (!navigator.clipboard) throw new Error('当前浏览器无法复制');
    await navigator.clipboard.writeText(message);
    return '已复制';
  }
  const result = await Share.share({ title, message });
  return result.action === Share.sharedAction ? '已分享' : undefined;
}
