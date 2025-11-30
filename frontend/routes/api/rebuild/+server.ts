import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
    try {
        await execAsync('node urara.js build');
        return json({ success: true });
    } catch (error) {
        console.error('Error running urara build:', error);
        return new Response('Failed to rebuild', { status: 500 });
    }
}
