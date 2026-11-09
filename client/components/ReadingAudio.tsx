import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import * as Speech from 'expo-speech';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { IconButton, Ink, paperStyles as p } from '@/components/Paper';
import type { PoemDetail } from '@/utils/api';
import { theme } from '@/theme';

const recording = require('@/assets/guanwen/audio/shan-ju-qiu-ming.m4a');

function time(milliseconds: number) {
  const seconds = Math.floor((Number.isFinite(milliseconds) ? milliseconds : 0) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ReadingAudio({ poem, autoplay, onMenu }: { poem: PoemDetail; autoplay: boolean; onMenu: () => void }) {
  const focused = useIsFocused();
  const sound = useRef<Audio.Sound | null>(null);
  const hasRecording = poem.title === '山居秋暝' && poem.author_name === '王维';
  const [playback, setPlayback] = useState<AVPlaybackStatus>();
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const loaded = playback?.isLoaded ? playback : undefined;
  const duration = loaded?.durationMillis ?? 0;
  const position = loaded?.positionMillis ?? 0;
  const canSeek = Number.isFinite(duration) && duration > 0 && Number.isFinite(position);
  const isPlaying = !!loaded?.isPlaying || speaking;

  const speak = useCallback(() => Speech.speak(poem.content, {
    language: 'zh-CN', rate: 0.8,
    onStart: () => setSpeaking(true),
    onDone: () => setSpeaking(false),
    onStopped: () => setSpeaking(false),
    onError: () => { setSpeaking(false); setError('系统朗读不可用'); },
  }), [poem.content]);

  useEffect(() => {
    if (!focused || !hasRecording) return;
    let active = true;
    let metadataTimer: ReturnType<typeof setInterval> | undefined;
    Audio.Sound.createAsync(recording, { shouldPlay: false, progressUpdateIntervalMillis: 200 }, (status) => {
      if (active) setPlayback(status);
    }).then(({ sound: instance, status }) => {
      if (!active) { void instance.unloadAsync().catch(() => undefined); return; }
      sound.current = instance;
      // Web receives its first playback status before the audio metadata arrives.
      if (Platform.OS === 'web' && (!status.isLoaded || !Number.isFinite(status.durationMillis))) {
        let attempts = 0;
        metadataTimer = setInterval(() => {
          void instance.getStatusAsync().then((current) => {
            if (!active) return;
            if (current.isLoaded && Number.isFinite(current.durationMillis)) {
              clearInterval(metadataTimer);
              setPlayback(current);
            }
          }).catch(() => clearInterval(metadataTimer));
          if (++attempts === 20) clearInterval(metadataTimer);
        }, 250);
      }
      if (autoplay) void instance.playAsync().catch(() => setError('点按播放以开始朗读'));
    }).catch(() => { if (active) setError('朗读音频加载失败，可使用系统朗读'); });
    return () => {
      active = false;
      clearInterval(metadataTimer);
      const instance = sound.current;
      sound.current = null;
      if (instance) void instance.unloadAsync().catch(() => undefined);
    };
  }, [hasRecording, focused, autoplay]);

  useEffect(() => {
    if (!focused) return;
    return () => { void Speech.stop().catch(() => undefined); };
  }, [focused]);

  useEffect(() => {
    if (!autoplay || !focused || hasRecording) return;
    // 浏览器需要点按播放来授权系统朗读。
    if (Platform.OS !== 'web') speak();
  }, [autoplay, focused, hasRecording, speak]);

  const toggle = async () => {
    setError('');
    try {
      if (sound.current && loaded) {
        if (loaded.isPlaying) await sound.current.pauseAsync();
        else if (loaded.durationMillis && loaded.positionMillis >= loaded.durationMillis - 200) await sound.current.replayAsync();
        else await sound.current.playAsync();
        return;
      }
      if (speaking) { await Speech.stop(); setSpeaking(false); return; }
      speak();
    } catch {
      setError('当前无法播放朗读');
    }
  };

  return <View style={styles.player}>
    <Pressable accessibilityLabel={isPlaying ? '暂停朗读' : '开始朗读'} accessibilityRole="button" style={styles.play} onPress={toggle}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} color="#fff7e9" size={23} />
    </Pressable>
    <View style={p.flex}>
      {loaded && canSeek ? <>
        <Slider accessibilityLabel="朗读进度" style={styles.slider} value={Math.max(0, Math.min(position, duration))} minimumValue={0} maximumValue={duration}
          minimumTrackTintColor={theme.primary} maximumTrackTintColor={theme.line} thumbTintColor={theme.primary}
          onSlidingComplete={(value) => { void sound.current?.setPositionAsync(value).catch(() => setError('当前无法跳转朗读进度')); }} />
        <Ink style={styles.time}>{error || `${time(position)} / ${time(duration)}`}</Ink>
      </> : <Ink style={styles.system}>{error || (hasRecording ? '00:00 / --:--' : '系统朗读')}</Ink>}
    </View>
    <IconButton icon="menu-outline" label="阅读菜单" onPress={onMenu} size={26} />
  </View>;
}

const styles = StyleSheet.create({
  player: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 64, backgroundColor: '#f4ece1', borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth },
  play: { width: 45, height: 45, borderRadius: 24, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  slider: { width: '100%', height: 22 },
  time: { textAlign: 'right', fontSize: 12, color: theme.inkSoft },
  system: { fontSize: 15, color: theme.inkSoft },
});
