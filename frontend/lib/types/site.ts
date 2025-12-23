import type { FFFAuthor } from 'fff-flavored-frontmatter'

export interface SiteConfig {
  author: {
    bio?: string
    metadata?: (
      | {
        text?: string
        icon: string
        link?: string
        rel?: string
      }
      | {
        icon?: string
        link?: string
        rel?: string
        text: string
      }
    )[]
    status?: string
  } & Omit<FFFAuthor, 'url'>
  description?: string
  domain: string
  keywords?: string[]
  lang?: string
  protocol: string
  subtitle?: string
  themeColor?: string
  title: string
}
