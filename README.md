[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# DocScrape

> 在任意网页上选择 DOM 元素并转换为 Markdown 的浏览器扩展。

![screenshot](./public/screenshot.png)

**功能亮点**：

- 在网页上点选元素，实时高亮预览
- 自动打开 Markdown 预览，支持渲染 / 源码切换
- 一键复制或下载 Markdown
- 支持多选合并导出
- 可选 YAML frontmatter（标题、URL、日期）
- 可选将图片转为 Base64 嵌入 Markdown
- 通过选项页自定义导出行为

## 本地运行

```bash
git clone <repo-url>
cd doc-scrape
pnpm install
pnpm dev
```

执行后会自动打开浏览器窗口并加载扩展。

## 使用方式

1. 在网页空白处右键 → **选择导出**，进入元素选择模式
2. 鼠标悬停高亮目标元素，点击即可选中
3. 选中后自动弹出确认栏和 Markdown 预览
4. 点击**下载 Markdown**保存文件，或点击**复制**到剪贴板
5. 按 `ESC` 可重新选择，再按一次 `ESC` 退出

右键菜单还提供**全页导出**，直接将整个页面转为 Markdown。

## 自定义设置

右键扩展图标 → **选项**，可配置：

- 文件名模板
- YAML frontmatter 开关与模板
- 图片是否转为 Base64 嵌入
- Markdown 标题风格与代码块风格

修改设置后无需刷新页面，新选择会立即生效。

## 项目结构

```
src/
├── background.ts        # 后台脚本
├── content/             # 内容脚本与 UI
│   ├── components/      # React 组件
│   ├── hooks/           # 状态逻辑
│   ├── lib/             # DOM / Markdown / 消息工具
│   ├── scripts.tsx      # 内容脚本入口
│   └── styles.css       # 浮层样式
├── lib/                 # 扩展全局共享库
│   └── config.ts        # 配置存储
├── options/             # 选项页
├── options.html         # 选项页入口
└── manifest.json        # 扩展清单
```

## 常用命令

### 开发

```bash
pnpm dev
pnpm dev -- --browser=chrome
pnpm dev -- --browser=firefox
```

### 构建

```bash
pnpm build              # 默认构建 Chromium 版本
pnpm build:chrome       # 指定 Chrome
pnpm build:zip:chrome   # 打包为 zip
```

### 预览

```bash
pnpm preview
```

## 技术栈

- [Extension.js](https://extension.js.org) — 浏览器扩展开发框架
- React 18 + TypeScript
- Turndown + turndown-plugin-gfm — HTML 转 Markdown
- marked — Markdown 渲染预览
- Shadow DOM — 样式隔离，避免与宿主页面冲突

## 了解更多

- [Extension.js 文档](https://extension.js.org)
- [React content script 示例](https://github.com/extension-js/examples/tree/main/examples/react)
