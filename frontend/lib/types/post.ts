export interface PostConfig {
  bridgy?: {
    [kind: string]: ('fed' | 'flickr' | 'github' | 'mastodon' | 'twitter')[]
  }
  comment?: CommentConfig
}

export interface CommentConfig {
  style?: 'bordered' | 'boxed' | 'lifted' | 'none'
  use: string[]
}
