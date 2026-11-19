# 观文 · Expo App + Express.js

## 启动观文

在本机使用 Node.js 24 和 pnpm 9。在项目根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm dev:local
```

打开 [http://localhost:8081](http://localhost:8081)。数据库配置留空时，前端使用内置选篇；杂剧和完整文集目录需要连接 Supabase。收藏、笔记、阅读记录与设置保存在当前浏览器或设备。按 Ctrl+C 结束运行。

### 连接原项目的 Supabase 数据

在项目根目录编辑 `.env`。若尚无此文件，复制 `.env.example` 为 `.env`。填写同一个 Supabase 项目的两项配置：

- `COZE_SUPABASE_URL` 填项目的 Project URL，例如 `https://你的项目引用.supabase.co`。在 Supabase 控制台的 **Integrations → Data API** 查看。 [Supabase Data API 文档](https://supabase.com/docs/guides/api)
- `COZE_SUPABASE_ANON_KEY` 填项目的 publishable key 或旧版 anon key，在 **Settings → API Keys** 查看。需要服务端写入权限时，可在 `COZE_SUPABASE_SERVICE_ROLE_KEY` 填该项目的 service_role key。 [Supabase API 密钥文档](https://supabase.com/docs/guides/getting-started/api-keys)

填写后重新运行 `pnpm dev:local`，Expo 和 Express 会一起启动。浏览器仍打开 8081，Expo 会把 API 请求转发给本机的 Express（默认 9091）。项目使用 Supabase 的 HTTP API，因此填写 Project URL 和 API key 即可。真实数据来自所连接的 Supabase 项目。如果端口已占用，可在 `.env` 中修改 `EXPO_PORT` 或 `SERVER_PORT`。数据库密钥只交给 Express，`.env` 已加入 Git 忽略规则。

在 Coze 中继续开发时，将压缩包中 `projects/` 内的文件放回原项目根目录，使用原有 Coze 启动配置。前端优先使用 Coze 注入的 `EXPO_PUBLIC_BACKEND_BASE_URL`，否则由 Web 同源代理转发。数据库由原项目的 Coze / Supabase 环境配置提供。

《山居秋暝》附带可拖动进度的普通话合成朗读。其他诗文使用设备或浏览器提供的中文朗读。

## 当前本地工作目录

所有代码、配置、安装与启动统一以 `/Users/liuzhang/vueProjects/huazhangguanwen` 为准。
原有 `.env` 已迁入此目录，应用继续通过 Supabase HTTP API 连接真实数据，无需 PostgreSQL 连接串。

## 数据结构升级（Supabase SQL Editor）

普通浏览、搜索、阅读在旧结构上也能运行。升级搜索索引、结构化注释、人物年表及作者别名字段：

1. 在项目根目录运行 `pnpm db:sql`，使用现有 Supabase 配置生成迁移文件，不修改数据库。
2. 在同一个 Supabase 项目的 SQL Editor 中打开并运行 `server/migrations/20261119_supabase_editor.sql` 的完整内容。
3. 刷新应用。服务端字段探测有 30 秒缓存，必要时重启 `pnpm dev:local`。

脚本事务内备份修改记录到非公开 schema `guanwen_internal`，保留诗文及旧作者 ID；仅合并已核验的柳永、王庭珪、晏殊三组记录。注释锚点仅在原文与生成时一致时写入。原始注释、译文、赏析不会被迁移覆盖。

需要回退资料时，同一项目 SQL Editor 运行 `server/migrations/20261119_supabase_rollback.sql`。回退保留新增字段、索引及函数，恢复被迁移字段的原值；请在产生新编辑前使用。

## 阅读与目录

杂剧从数据库按楔子、各折聚合，保留真实目录顺序。诗词、散曲、赋、小品、文章等使用对应正文布局；标题旁显示文体标签。注释词使用淡色背景，点击查看释义。结构化注释按原文位置定位，旧数据继续兼容词条解析。

人物作品按页获取，超过 500 篇也可继续翻页。赏读和生平由用户点击后生成，只补充数据库空缺字段，保留已有编辑。文集目录继续使用 `collection_entries` 的卷次与篇序，不按文体虚构卷名。


迁移后运行 `pnpm db:verify` 核对作者别名、原文数量、结构化注释、人物资料、批量统计及搜索。此命令只读核验，不修改真实作品。结果保存在本机 `.local/migration-verification.json`。

搜索一个或两个字时匹配作者、文集及篇名；至少输入三个字时同时搜索正文，以避免短词全文扫描超时。

## 目录结构规范（严格遵循）

当前仓库是一个 monorepo（基于 pnpm 的 workspace）

- Expo 代码在 client 目录，Express.js 代码在 server 目录
- 本模板默认无 Tab Bar，可按需改造

├── client/                     # React Native 前端代码
│   ├── app/                    # Expo Router 路由目录（仅路由配置）
│   │   ├── _layout.tsx         # 根布局文件（必需，务必阅读）
│   │   └── index.tsx           # 首页
│   ├── screens/                # 页面实现目录（与 app/ 路由对应）
│   │   └── demo/               # 示例页面
│   │       └── index.tsx
│   ├── components/             # 可复用组件
│   │   └── Screen.tsx          # 页面容器组件（必用）
│   ├── hooks/                  # 自定义 Hooks
│   ├── contexts/               # React Context 代码
│   ├── utils/                  # 工具函数
│   ├── assets/                 # 静态资源
|   └── package.json            # Expo 应用 package.json
├── server/                     # 服务端代码根目录 (Express.js)
|   ├── src/
│   │   └── index.ts            # 服务端入口文件
|   └── package.json            # 服务端 package.json
├── package.json
├── .cozeproj                   # 预置脚手架脚本（禁止修改）
└── .coze                       # 配置文件（禁止修改）

## 样式方案

基于 tailwindcss 进行样式开发（底层基于 Uniwind）

写法示例：

```tsx
<View className="flex-1 bg-white dark:bg-gray-900 p-4"></View>
```

```tsx
<Text
  className="text-lg font-bold text-gray-900 dark:text-white"
  selectionColorClassName="accent-blue-500"
>
  Hello World
</Text>
```

Uniwind 官方文档：https://docs.uniwind.dev/llms.txt

## 如何进行静态校验（TSC + ESLint）

```bash
# 对 client 和 server 目录同时进行校验
pnpm -w lint:all

# 对 client 目录进行校验
pnpm -w lint:client

# 对 server 目录进行校验
pnpm -w lint:server
```

## 如何修改主题模式（跟随系统、固定暗色、固定亮色）

默认为跟随系统，如果用户明确指定为“暗色”或“亮色”，需要修改 `client/components/ColorSchemeUpdater.tsx` 的 `DEFAULT_THEME` 变量为合适的值

## 如何定制主题 design tokens

当前项目的**设计系统**基于 tailwindcss 实现，核心入口文件为 `client/global.css`，如果需要定制主题，应该**阅读并修改 `client/global.css` 文件**

## 路由及 Tab Bar 实现规范

### 方案一：无 Tab Bar（Stack 导航）

适用于线性流程应用，采用简化的目录结构：

```
client/app/
├── _layout.tsx         # 根布局（Stack 导航配置）
├── index.tsx           # 应用入口
├── detail.tsx          # 详情页（通过 params 传递数据）
└── +not-found.tsx      # 404 页面
```

**根布局配置** `client/app/_layout.tsx`：

以下仅为代码片段供写法参考

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="detail" />
</Stack>
```

**应用入口** `client/app/index.tsx`：
```tsx
export { default } from "@/screens/home";
```
> **禁止事项**：无 Tab Bar 场景下，不得创建 `(tabs)` 目录。

### 方案二：有 Tab Bar（Tabs 导航）

采用路由分组实现底部导航栏：
```
client/app/
├── _layout.tsx              # 根布局
├── (tabs)/
│   ├── _layout.tsx          # Tab 导航配置
│   ├── index.tsx            # 默认 Tab（必须存在）
│   ├── discover.tsx         # 发现页
│   └── profile.tsx          # 个人中心
├── detail.tsx               # Tab 外的独立页面（通过 params 传递数据）
└── +not-found.tsx
```
> **⚠️ [CRITICAL]**： `app/index.tsx` 优先级高于 `(tabs)/index.tsx`，会导致首页无 Tab Bar。**当有(tabs)/index.tsx时必须删除 `app/index.tsx`**。

**根布局配置** `client/app/_layout.tsx`：

以下仅为代码片段供写法参考

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="detail" />
</Stack>
```

**应用入口** `client/app/(tabs)/index.tsx`：
```tsx
export { default } from "@/screens/home";
```

**Tab 布局配置** `client/app/(tabs)/_layout.tsx`：

```tsx
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
  };

  // 用于修复 Web 上高度异常的问题（这个 if 逻辑必须添加）
  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
      }}
    >
      {/* name 必须与文件名完全一致 */}
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="house" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="compass" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Tab 页面文件** `client/app/(tabs)/index.tsx`：
```tsx
export { default } from "@/screens/home";
```

### 注意事项

在改动 `client/app/_layout.tsx` 前，必须先阅读该文件，再进行修改操作

以下是需要保留的重要逻辑

- 保留 global.css 引入（tailwindcss 生效的关键）
- 保留 Provider 的使用

## 依赖管理与模块导入规范

### 依赖安装
**禁止**使用 `npm` 或 `yarn`，按目录区分安装命令：

| 目录 | 安装命令 | 说明 |
|------|----------|------|
| `client/` | `npx expo install <package>` | Expo 会自动选择与 SDK 兼容的版本 |
| `server/` | `pnpm add <package>` | 使用 pnpm 管理后端依赖 |

```bash
# client 目录（Expo 项目）
cd client && npx expo install expo-camera expo-image-picker

# server 目录（Express 项目）
cd server && pnpm add axios cors
```

**网络问题处理**：`npx expo install` 可能因网络原因失败，失败时重试 2 次，仍失败则改用 `pnpm add` 安装

## Expo 开发规范

### 路径别名

Expo 配置了 `@/` 路径别名指向 `client/` 目录：

```tsx
// 正确
import { Screen } from '@/components/Screen';

// 避免相对路径
import { Screen } from '../../../components/Screen';
```

## 本地开发

`coze dev`：用来首次启动前后端服务，也可以用来重启前后端服务（该命令会先尝试杀掉占用端口的进程，再启动服务）
