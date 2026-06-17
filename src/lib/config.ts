export interface DocScrapeConfig {
  /** 导出时是否添加 YAML frontmatter */
  includeFrontmatter: boolean
  /** frontmatter 字段模板 */
  frontmatterTemplate: string
  /** 文件名模板，支持 {{title}} {{date}} {{selector}} */
  filenameTemplate: string
  /** Markdown 标题风格 */
  headingStyle: 'atx' | 'setext'
  /** 代码块风格 */
  codeBlockStyle: 'fenced' | 'indented'
}

export const defaultConfig: DocScrapeConfig = {
  includeFrontmatter: true,
  frontmatterTemplate: '---\ntitle: {{title}}\nurl: {{url}}\ndate: {{date}}\n---\n\n',
  filenameTemplate: '{{title}}.md',
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
}

const STORAGE_KEY = 'docscrape_config'

export async function getConfig(): Promise<DocScrapeConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const saved = (result[STORAGE_KEY] || {}) as Partial<DocScrapeConfig>
  return { ...defaultConfig, ...saved }
}

export async function saveConfig(config: DocScrapeConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config })
}

export function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')
}
