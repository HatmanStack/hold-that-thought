/** @type {import('./$types').PageServerLoad} */
export function load({ setHeaders }) {
  // Set cache-control headers for this page's response
  setHeaders({
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  return {
    // This page data should not be cached
    timestamp: new Date().toISOString()
  };
}
