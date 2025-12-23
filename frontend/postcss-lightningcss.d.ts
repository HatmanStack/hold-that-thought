declare module 'postcss-lightningcss' {
  import type { PluginCreator } from 'postcss'

  interface Options {
    browsers?: string
    lightningcssOptions?: {
      minify?: boolean
      sourceMap?: boolean
      drafts?: {
        customMedia?: boolean
        nesting?: boolean
      }
      errorRecovery?: boolean
    }
  }
  const plugin: PluginCreator<Options>
  export default plugin
}
