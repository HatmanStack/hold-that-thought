import { PUBLIC_RAGSTACK_API_KEY, PUBLIC_RAGSTACK_GRAPHQL_URL } from '$env/static/public'

export interface SearchResult {
  content: string
  source: string
  score: number
  filename: string
  category?: 'pictures' | 'videos' | 'documents'
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
  error?: string
}

const SEARCH_QUERY = `query SearchKnowledgeBase($query: String!, $maxResults: Int) {
  searchKnowledgeBase(query: $query, maxResults: $maxResults) {
    results { content, source, score }
  }
}`

function extractFilename(source: string): string {
  // Handle s3:// URLs, regular URLs, or paths
  // s3://bucket/path/to/file.jpg → file.jpg
  // https://example.com/path/file.jpg → file.jpg
  // /path/to/file.jpg → file.jpg
  const parts = source.split('/')
  return parts[parts.length - 1] || source
}

function categorizeResult(source: string): 'pictures' | 'videos' | 'documents' {
  const lowerSource = source.toLowerCase()

  if (/\.(?:jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)(?:\?|$)/i.test(lowerSource)
    || lowerSource.includes('/pictures/')
    || lowerSource.includes('/images/')) {
    return 'pictures'
  }

  if (/\.(?:mp4|mov|avi|mkv|webm|m4v|wmv)(?:\?|$)/i.test(lowerSource)
    || lowerSource.includes('/videos/')) {
    return 'videos'
  }

  return 'documents'
}

export async function searchKnowledgeBase(
  query: string,
  maxResults: number = 20,
): Promise<SearchResponse> {
  if (!PUBLIC_RAGSTACK_GRAPHQL_URL) {
    throw new Error('RAGStack GraphQL URL not configured')
  }

  if (!query.trim()) {
    return { query: '', results: [], total: 0 }
  }

  const response = await fetch(PUBLIC_RAGSTACK_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PUBLIC_RAGSTACK_API_KEY || '',
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { query, maxResults },
    }),
  })

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`)
  }

  const json = await response.json()
  console.log('Search raw response:', json)

  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }

  const data = json.data?.searchKnowledgeBase
  const results = data?.results || []
  console.log('Search results count:', results.length)
  console.log('Search results:', results)

  const categorizedResults = results.map((result: SearchResult) => ({
    ...result,
    filename: extractFilename(result.source),
    category: categorizeResult(result.source),
  }))
  console.log('Categorized results:', categorizedResults)

  return {
    query,
    results: categorizedResults,
    total: categorizedResults.length,
  }
}

export function filterResultsByCategory(
  results: SearchResult[],
  category: 'pictures' | 'videos' | 'documents',
): SearchResult[] {
  return results.filter(result => result.category === category)
}
