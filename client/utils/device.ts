import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

let cached: string | null = null;

/**
 * 获取全局一致的设备 ID（UUID）。
 * 首次生成后持久化到 AsyncStorage，多端一致，用于推荐个性化。
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem('poetry_device_id');
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch { /* ignore */ }
  const id = Crypto.randomUUID();
  try {
    await AsyncStorage.setItem('poetry_device_id', id);
  } catch { /* ignore */ }
  cached = id;
  return id;
}