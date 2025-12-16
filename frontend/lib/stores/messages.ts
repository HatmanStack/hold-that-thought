import { getConversations } from '$lib/services/message-service'
import { writable } from 'svelte/store'

/**
 * Store for total unread message count
 */
export const unreadCount = writable(0)

/**
 * Update the unread count by fetching all conversations
 */
export async function updateUnreadCount(): Promise<void> {
  try {
    const result = await getConversations()

    if (result.success && result.data) {
      const conversations = Array.isArray(result.data) ? result.data : [result.data]
      const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
      unreadCount.set(total)
    }
    else {
      // On error, keep current count
      console.error('Failed to update unread count:', result.error)
    }
  }
  catch (error) {
    console.error('Error updating unread count:', error)
  }
}
