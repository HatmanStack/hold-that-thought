import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';

export const GET: RequestHandler = async () => {
    try {
        console.log('Fetching letters list from S3...');
        
        const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/pdf-download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'list',
                prefix: 'urara/'
            })
        });

        if (!response.ok) {
            console.error('Failed to fetch letters list:', response.status);
            return new Response('Failed to fetch letters list', { status: 500 });
        }

        const data = await response.json();
        console.log('Successfully fetched letters list');
        
        // Transform S3 keys to post format
        const posts = data.files?.map((file: any) => {
            // Extract path from S3 key (remove urara/ prefix and /+page.svelte.md suffix)
            let path = file.key.replace('urara/', '').replace('/+page.svelte.md', '');
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
            
            return {
                title: path.substring(1), // Remove leading slash for title
                path: path,
                created: file.lastModified || new Date().toISOString(),
                type: 'article' as const,
                html: '',
                size: file.size || 0
            };
        }) || [];

        return json(posts);
    } catch (error) {
        console.error('Error fetching letters list:', error);
        return new Response('Internal server error', { status: 500 });
    }
};
