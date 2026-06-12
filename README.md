[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# DocScrape

> Browser extension to select HTML elements and convert them to Markdown.

![screenshot](./public/screenshot.png)

**What you'll see**: A content-script UI injected into web pages inside a Shadow DOM, with element selection and Markdown export.

**How it works**: Right-click to choose an element or export the full page. The content script converts HTML to Markdown and downloads the result.

## Try it locally

```bash
git clone <repo-url>
cd doc-scrape
pnpm install
pnpm dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── ContentApp.tsx
│   ├── scripts.tsx
│   └── styles.css
├── images/
│   └── icon.png
├── types/
│   └── turndown-plugin-gfm.d.ts
├── background.ts
└── manifest.json
```

## Commands

### dev

Run the extension in development mode:

```bash
pnpm dev
pnpm dev -- --browser=chrome
pnpm dev -- --browser=firefox
```

### build

Build for production:

```bash
pnpm build
pnpm build:chrome
pnpm build:zip:chrome
```

### preview

Preview the production build in the browser:

```bash
pnpm preview
```

## Learn more

- [Extension.js docs](https://extension.js.org)
- [React content script example](https://github.com/extension-js/examples/tree/main/examples/react)
