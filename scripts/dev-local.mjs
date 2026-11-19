import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const host = '127.0.0.1';
const useProcessGroup = process.platform !== 'win32';
const children = [];
let stopping = false;

function readPort(name, defaultPort) {
  const port = Number(process.env[name] || defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} 应填写 1–65535 之间的端口号。`);
  }
  return port;
}

async function checkPort(port, name) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) => {
      reject(new Error(`无法使用端口 ${port}（${error.code}），请修改 .env 中的 ${name}。`));
    });
    probe.listen(port, () => probe.close(resolve));
  });
}

function stop(signal, code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (useProcessGroup) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
}

function start(name, directory, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: fileURLToPath(new URL(directory, root)),
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: useProcessGroup,
  });
  children.push(child);
  child.once('error', (error) => {
    console.error(`${name} 启动失败：${error.message}`);
    stop('SIGTERM', 1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    if (code !== 0) console.error(`${name} 已退出（${signal ?? code}）。`);
    stop('SIGTERM', code ?? 1);
  });
}

try {
  const {
    COZE_SUPABASE_URL: rawUrl,
    COZE_SUPABASE_ANON_KEY: rawKey,
    COZE_SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    DATABASE_URL: databaseUrl,
    ...expoEnv
  } = process.env;
  const url = rawUrl?.trim();
  const key = rawKey?.trim();
  if (Boolean(url) !== Boolean(key)) {
    throw new Error('请在 .env 同时填写 COZE_SUPABASE_URL 和 COZE_SUPABASE_ANON_KEY，或将两项都留空。');
  }
  if (url && (!URL.canParse(url) || !/^https?:\/\//iu.test(url))) {
    throw new Error('COZE_SUPABASE_URL 应填写以 https:// 或 http:// 开头的 Supabase Project URL。');
  }

  const expoPort = readPort('EXPO_PORT', 8081);
  const serverPort = readPort('SERVER_PORT', 9091);
  if (url && expoPort === serverPort) throw new Error('EXPO_PORT 和 SERVER_PORT 应使用不同端口。');
  await checkPort(expoPort, 'EXPO_PORT');
  if (url) await checkPort(serverPort, 'SERVER_PORT');

  process.once('SIGINT', () => stop('SIGINT', 130));
  process.once('SIGTERM', () => stop('SIGTERM', 143));

  if (url) {
    console.log('观文将通过本地 Express 读取 Supabase 数据。');
    start('Express', 'server/', ['node_modules/tsx/dist/cli.mjs', 'watch', '--clear-screen=false', 'src/index.ts'], {
      ...process.env,
      COZE_SUPABASE_URL: url,
      COZE_SUPABASE_ANON_KEY: key,
      COZE_SUPABASE_SERVICE_ROLE_KEY: serviceKey?.trim() ?? '',
      SERVER_HOST: host,
      PORT: String(serverPort),
    });
  } else {
    console.log('观文将使用内置选篇。');
  }

  start('Expo', 'client/', ['node_modules/expo/bin/cli', 'start', '--web', '--localhost', '--port', String(expoPort)], {
    ...expoEnv,
    EXPO_OFFLINE: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_BACKEND_BASE_URL: '',
    EXPO_PUBLIC_USE_LOCAL_CONTENT: url ? '0' : '1',
    SERVER_HOST: host,
    SERVER_PORT: String(serverPort),
  });
} catch (error) {
  console.error(error.message);
  stop('SIGTERM', 1);
}
