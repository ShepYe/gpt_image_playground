# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

纯前端单页应用（无自建后端）：React 19 + Vite + TypeScript + Zustand + Tailwind CSS 3。
用浏览器直连各家图像生成 API，所有任务记录与图片都存在**用户浏览器本地**，不经过任何第三方服务器。

包管理器为 npm（有 `package-lock.json`），不要使用 yarn / pnpm。构建产物在 `dist/`，不要手动编辑。

## 代码风格与工作约定

本仓库的详细开发约定（代码风格、命名、import 顺序、防御性代码边界、版本发布流程）写在 `AGENTS.md`，它对本仓库具有强制力，请一并遵守：

@AGENTS.md

其中最容易违反、需要时刻记住的几条：

- 2 空格缩进、单引号、**无分号**、箭头函数始终加括号。
- 注释和 UI 文案使用**中文**；注释说明"为什么"，不写"做了什么"。
- 简单优先：不为单次使用的 1-5 行逻辑抽函数；不引入项目里不存在的设计模式或架构层。
- 不留 `// TODO` 或 stub，不确定的细节直接给出完整实现。
- 修改文件时**跟随该文件既有风格**，这是最高优先级规则。

## 常用命令

| 操作 | 命令 |
|------|------|
| 安装依赖 | `npm install` |
| 开发服务器 | `npm run dev`（http://localhost:5173） |
| 构建 | `npm run build`（`tsc -b && vite build`） |
| 运行全部测试 | `npm test`（vitest run） |
| 监听测试 | `npm run test:watch` |
| **运行单个测试文件** | `npx vitest run src/lib/api.test.ts` |
| 按用例名过滤 | `npx vitest run src/lib/api.test.ts -t "用例名"` |
| 本地故障模拟 API | `npm run mock:api`（http://127.0.0.1:8787） |
| 部署到 Cloudflare Workers | `npm run deploy:cf`（先 build 再 `wrangler deploy`） |
| Windows 一键启动 / 部署 | `start.bat` / `deploy.bat` |

- 仓库**没有 lint / formatter 配置**，不要新增（除非明确要求）。
- `start.bat` / `deploy.bat` 是**无 BOM 的 UTF-8 + CRLF**，开头有一段 `chcp 65001` 后自我重启的逻辑；改动时该重启块之前的内容必须是纯 ASCII，中文只能放在它之后，否则双击运行会吞字。
- 本地故障模拟 API 的可用路径（跨域失败、结构异常、流式异常等）见 `docs/mock-image-api.md`，改动图片接口解析逻辑时可用它复现各类异常分支。

## 架构

### 两条 UI 主线

`appMode` 决定整个界面走哪条链路，两者共用设置、任务记录与画廊数据：

- `gallery` —— 画廊模式，直接调用图像 API 生成/编辑。
- `agent` —— Agent 模式，基于 Responses API 的多轮对话，由模型自行调用图像工具。

### 状态与持久化（本项目最容易踩坑的地方）

`src/store.ts`（4500+ 行）是唯一 store，Zustand `create` + `persist`。

- localStorage 持久化：key `gpt-image-playground`，`version: 2`，通过 `partialize` / `migrate` / `merge` 三个钩子控制（`getPersistedState` 与 `mergePersistedState` 定义在 `store.ts` 内，`createPersistedState` / `migratePersistedState` / `normalizePersistedState` 在 `src/lib/persistedState.ts`）。**设置类数据（settings、profiles、收藏夹等）走这里。**
- IndexedDB：`src/lib/db.ts` 封装，DB 名 `gpt-image-playground`，当前 `DB_VERSION = 3`，四个 object store：`tasks` / `images` / `thumbnails` / `agentConversations`。**任务记录、图片（含 SHA-256 去重）、缩略图、Agent 会话走这里。**
- 两套存储不是一回事：新增 state 字段时要先想清楚该进 localStorage 还是 IndexedDB，并考虑旧数据的恢复路径（store 顶部与 `src/lib/*` 中的 `normalize*` / `ensure*` 函数就是为清洗旧格式数据而存在，修改时必须保持向后兼容）。
- 改 IndexedDB schema 必须升 `DB_VERSION` 并在 `onupgradeneeded` 里补建 store。
- `store.ts` 不只导出 `useStore`，还在模块级导出了大量流程函数：`initStore`、`submitTask`、`submitAgentMessage`、`regenerateAgentAssistantMessage`、`retryTask`、`reuseConfig`、`editOutputs`、`removeTask`、`clearData`、`exportData` / `importData`、`addImageFromFile` / `addImageFromUrl` 等。**组件通过调用这些函数驱动业务，而不是自己拼 state 变更。**
- 应用启动时必须调用一次 `initStore()`（见 `src/App.tsx`）完成从 IndexedDB 的恢复。

### API 层（`src/lib/`）

请求分发链路：`callImageApi`（`src/lib/api.ts`）是画廊模式的统一入口，按 `profile.provider` 分发到不同实现。

- `src/lib/openaiCompatibleImageApi.ts` —— OpenAI 兼容供应商，含 `images` 与 `responses` 两种 `apiMode`；文生图发 JSON、图生图发 multipart。**自定义供应商也由这里的模板引擎驱动**：`submit` / `editSubmit` / `poll` 中的 `$profile.*` / `$params.*` / `$prompt` / `$inputImages.*` / `$mask.*` 变量在运行时替换。
  注意内置的 `sb2api-async` 本身就是一个 `CustomProviderDefinition`（见 `apiProfiles.ts` 的 `SUB2API_PROVIDER`），走的是和用户自定义供应商完全相同的模板引擎——新增内置异步供应商应照此写法，而不是新开一套请求代码。
- `src/lib/falAiImageApi.ts` —— fal.ai（队列轮询）。
- `src/lib/agentApi.ts` + `agentResponseState.ts` + `agentInputBuilder.ts` + `agentImageReferences.ts` + `agentConversationState.ts` —— Agent 模式的工具调用循环、分支管理、引用解析与消息恢复。
- `src/lib/imageApiShared.ts` —— 各实现共用的请求/响应类型（`CallApiOptions` / `CallApiResult`）、体积上限常量、base64 与 Responses 结果解析工具，以及**面向用户的错误提示文案**（流式不支持、CORS、透明背景不支持等）。新增这类提示请放这里，不要在各实现里重复写字符串。

配置模型方面：`src/lib/apiProfiles.ts` 定义内置供应商（`openai` / `sb2api-async` / `fal`）与 `ApiProfile` 的归一化、校验、导入合并；`src/lib/presetConfig.ts` 负责部署端预置配置的注入、锁定、删除保护与下线清理策略。改动这两个文件要特别注意向后兼容。

**供应商差异是散落的 `provider === 'xxx'` 条件判断，没有集中抽象**：除了 `api.ts` 的分发入口，`apiProfiles.ts`（默认值、`apiMode`、流式、代理、标签）、`paramCompatibility.ts`（输出张数上限、参数兼容）、`taskState.ts`（实际参数提取）、`urlSettings.ts`、`imageModels.ts` 里都有各自的判断。若要新增一个内置供应商或改动某供应商的默认行为，需要用 `grep -rn "provider === " src/` 找齐全部触点，否则会出现"UI 改了但请求没改"这类不一致。

### 入口与 UI

- `src/App.tsx` 是顶层组件树；`src/components/` 按功能分目录（`settings/`、`input/`、`favorites/`）。
- 启动时 `App.tsx` 还会读取 URL 查询参数（`?apiUrl=` / `?model=` / `?settings=` 等）覆盖设置并随即从地址栏清除，逻辑在 `src/lib/urlSettings.ts`。这是配置导入与分享链接的入口，也同时被 `VITE_DEFAULT_API_URL` 的预置配置复用。
- **纯逻辑一律放 `src/lib/`**（多为纯函数 + 同名 `.test.ts`），hooks 放 `src/hooks/`。`store.ts` 已过大，新工具函数不要再往里加。
- `src/types.ts` 存放跨模块共享类型，局部类型放文件顶部。
- 样式：`src/index.css` 用 CSS 变量定义主题色，Tailwind 里以 `hsl(var(--background))` 形式引用；`tailwind.config.js` 中 `darkMode: 'media'`，**深色模式跟随系统，没有手动切换开关**。

### 构建期注入

`vite.config.ts` 在构建/启动时做两件影响运行时的事，改完必须重启 dev server 或重新构建：

- `VITE_DEFAULT_API_URL` 会被解析（支持 API 地址、JSON 文件路径、远程 JSON URL 三种写法）并转成 `embedded-config:<base64>` 注入。相关环境变量还有 `VITE_LOCK_PRESET_CONFIG_PARAMS` / `VITE_PREVENT_PRESET_CONFIG_DELETION` / `VITE_SHOW_PRESET_CONFIG_ONLY`，详见 README。
- `dev-proxy.config.json`（**已被 gitignore**）被序列化为 `__DEV_PROXY_CONFIG__`，驱动 `vite dev` 的 `/api-proxy` 转发，用于绕开浏览器 CORS 限制。该代理**只在 `npm run dev` 生效**，不影响打包产物；生产环境要走代理需用 Docker 的 Nginx 方案。
- 全局常量 `__APP_VERSION__` / `__DEV_PROXY_CONFIG__` 在 `src/vite-env.d.ts` 中声明。

### 部署

同一份静态产物可部署到 Vercel / GitHub Pages / Cloudflare Workers / Docker：

- Cloudflare Workers 见 `wrangler.jsonc`（`assets.directory` 指向 `dist/`，`routes` 里绑定自定义域名）。
- Docker 见 `deploy/`（Nginx + `inject-api-url.sh` 在容器启动时把 `DEFAULT_API_URL` 注入静态文件），运行变量与构建变量名不同（`DEFAULT_API_URL` vs `VITE_DEFAULT_API_URL`）。
- `.github/workflows/` 下三个工作流都只在 `package.json` 变化（即版本号提升）时触发，普通提交不会部署。

### 发布版本

发版时需同步修改 `package.json`、`package-lock.json`、`public/sw.js` 的 `CACHE_NAME` 与 `RELEASE.md`（本仓库 `RELEASE.md` **只保留最新一次发布记录**）。完整流程与格式要求见 `AGENTS.md` 的「发布版本升级」一节。

## 验证顺序

修改完成后先 `npm run build` 验证类型与编译，再 `npm test` 验证测试；涉及界面或网络链路时，用 `npm run dev` 在真实应用里确认一次。
