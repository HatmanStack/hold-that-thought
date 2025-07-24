import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'
import { checkAPIGatewayConnection } from '$lib/services/gallery-service'
import { extractTokenFromHeader } from '$lib/auth/jwt'

export const GET: RequestHandler = async (event) => {
  try {
    // Ensure user is authenticated and approved
    const user = await requireApprovedUser(event)
    
    // Get the JWT token from the Authorization header
    const authHeader = event.request.headers.get('Authorization')
    const token = extractTokenFromHeader(authHeader)
    
    if (!token) {
      return json({ error: 'No authentication token available' }, { status: 401 })
    }
    
    // Check API Gateway connection
    const apiGatewayConnected = await checkAPIGatewayConnection(token)
    
    return json({
      success: true,
      status: 'healthy',
      services: {
        apiGateway: apiGatewayConnected ? 'connected' : 'disconnected',
        authentication: 'working'
      },
      user: {
        id: user.id,
        email: user.email,
        groups: user.groups
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Gallery health check failed:', error)
    
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return json({ error: 'Authentication required' }, { status: 401 })
    }
    
    if (error instanceof Error && error.message.includes('ApprovedUsers')) {
      return json({ error: 'Access denied. User not in ApprovedUsers group.' }, { status: 403 })
    }
    
    return json({ 
      success: false,
      status: 'unhealthy',
      error: 'Gallery service unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}