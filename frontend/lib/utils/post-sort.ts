export function sortPostsByDate(posts: Urara.Post[]): Urara.Post[] {
  return [...posts].sort((a, b) => {
    // Extract dates from the posts
    const dateA = a.created ? new Date(a.created).getTime() : 0
    const dateB = b.created ? new Date(b.created).getTime() : 0

    // Sort descending (newest first)
    return dateB - dateA
  })
}

export function groupPostsByYear(posts: Urara.Post[]): Record<string | number, Urara.Post[]> {
  const sorted = sortPostsByDate(posts)
  const grouped: Record<string | number, Urara.Post[]> = {}

  sorted.forEach((post) => {
    if (post.created) {
      const year = new Date(post.created).getFullYear()
      if (!grouped[year]) {
        grouped[year] = []
      }
      grouped[year].push(post)
    }
    else {
      // Handle posts without dates
      if (!grouped.Unknown) {
        grouped.Unknown = []
      }
      grouped.Unknown.push(post)
    }
  })

  return grouped
}
