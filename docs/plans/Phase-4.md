# Phase 4: Messaging System

## Phase Goal

Build a complete direct messaging system allowing family members to send messages, create group conversations, and share attachments. This phase implements inbox/conversation list UI, message thread display, and file attachment upload functionality.

**Success Criteria:**
- Users can start 1-on-1 conversations
- Users can create group conversations
- Users can send text messages and attachments
- Inbox shows all conversations sorted by recent activity
- Message threads display chronologically
- Unread message counts displayed
- Email notifications sent for new DMs

**Estimated Tokens: ~90,000**

---

## Prerequisites

Before starting this phase:

- [ ] Phase 1 complete (messages-api Lambda functional)
- [ ] Can send messages via curl/Postman (verify backend works)
- [ ] Understand conversation ID generation (userId pairs)

---

## Task 1: Create Message Service API Client

**Goal:** Build TypeScript service layer for messaging operations.

**Files to Create:**
- `src/lib/services/messageService.ts` - Message API client
- `src/lib/types/message.ts` - TypeScript interfaces

**Implementation Steps:**

1. Define TypeScript interfaces for Message, Conversation, Attachment
2. Implement API client functions:
   - `getConversations()` - List user's conversations
   - `getMessages(conversationId, limit, lastKey)` - Fetch messages
   - `createConversation(participantIds, messageText)` - Start new conversation
   - `sendMessage(conversationId, messageText, attachments)` - Send message
   - `markAsRead(conversationId)` - Mark conversation as read
   - `uploadAttachment(file)` - Get presigned URL and upload
3. Handle errors appropriately

**Architecture Guidance:**

Example interfaces:
```typescript
export interface Message {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  messageText: string;
  attachments?: Attachment[];
  createdAt: string;
  conversationType: 'direct' | 'group';
  participants: string[];
}

export interface Conversation {
  conversationId: string;
  conversationType: 'direct' | 'group';
  participantIds: string[];
  participantNames: string[];
  lastMessageAt: string;
  unreadCount: number;
  conversationTitle?: string; // For groups
}

export interface Attachment {
  s3Key: string;
  filename: string;
  contentType: string;
  size: number;
}
```

**Verification Checklist:**

- [ ] TypeScript interfaces defined
- [ ] All API functions implemented
- [ ] Error handling for network failures
- [ ] No TypeScript errors

**Commit Message Template:**
```
feat(messages): create message API service client

- Define Message, Conversation, Attachment interfaces
- Implement getConversations, getMessages, sendMessage
- Add createConversation and markAsRead
- Add uploadAttachment for file uploads

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 2: Create ConversationList Component

**Goal:** Build inbox UI showing all user's conversations.

**Files to Create:**
- `src/lib/components/messages/ConversationList.svelte` - Conversation list

**Implementation Steps:**

1. Fetch conversations on mount via `getConversations`
2. Display list sorted by `lastMessageAt` (most recent first)
3. For each conversation show:
   - Participant names (or group title)
   - Last message preview (first 50 chars)
   - Timestamp (relative: "2 hours ago")
   - Unread count badge (if > 0)
4. Make each row clickable → navigate to message thread
5. Add "New Message" button at top
6. Show empty state if no conversations

**Architecture Guidance:**

- **Component Events:**
  - `conversationSelected` - Emitted when conversation clicked, passes conversationId

- **Unread Badge:**
  ```svelte
  {#if conversation.unreadCount > 0}
    <span class="badge">{conversation.unreadCount}</span>
  {/if}
  ```

**Verification Checklist:**

- [ ] Fetches conversations on mount
- [ ] Displays all conversations sorted by recent
- [ ] Shows participant names (or group title)
- [ ] Shows last message preview
- [ ] Shows unread count badge
- [ ] Clicking row navigates to thread
- [ ] "New Message" button visible
- [ ] Empty state if no conversations

**Commit Message Template:**
```
feat(messages): create ConversationList component

- Fetch and display user's conversations
- Sort by most recent activity
- Show participant names and last message preview
- Display unread count badges
- Add "New Message" button
- Navigate to thread on click

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Task 3: Create MessageThread Component

**Goal:** Build chat-style UI for displaying messages in a conversation.

**Files to Create:**
- `src/lib/components/messages/MessageThread.svelte` - Message thread display

**Implementation Steps:**

1. Fetch messages via `getMessages` on mount
2. Display messages chronologically (oldest first, bottom)
3. Show each message:
   - Sender avatar and name
   - Message text (preserve line breaks)
   - Attachments (clickable to download/view)
   - Timestamp
4. Differentiate own messages (align right, different color)
5. Add "Load Older Messages" button at top for pagination
6. Auto-scroll to bottom on load and new message
7. Show typing indicator placeholder (optional)
8. Mark conversation as read on mount

**Architecture Guidance:**

- **Component Props:**
  - `conversationId: string`
  - `currentUserId: string`

- **Message Styling:**
  ```svelte
  <div class="message" class:own={message.senderId === currentUserId}>
    <div class="avatar">...</div>
    <div class="content">
      <p>{message.messageText}</p>
      {#each message.attachments as attachment}
        <a href={attachment.url}>{attachment.filename}</a>
      {/each}
      <span class="timestamp">{formatTime(message.createdAt)}</span>
    </div>
  </div>
  ```

- **Auto-Scroll:**
  ```typescript
  onMount(() => {
    scrollToBottom();
  });
  
  afterUpdate(() => {
    if (shouldScroll) {
      scrollToBottom();
    }
  });
  
  function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
  }
  ```

**Verification Checklist:**

- [ ] Fetches messages on mount
- [ ] Displays messages chronologically
- [ ] Own messages align right
- [ ] Other messages align left
- [ ] Attachments display as clickable links
- [ ] Auto-scrolls to bottom on load
- [ ] "Load Older" button for pagination
- [ ] Marks conversation as read on mount

**Commit Message Template:**
```
feat(messages): create MessageThread component

- Fetch and display messages in conversation
- Show sender avatar, name, text, attachments
- Differentiate own messages (align right)
- Auto-scroll to bottom on load
- Add pagination for older messages
- Mark conversation as read on mount

Estimated tokens: ~12000
```

**Estimated Tokens: ~12000**

---

## Task 4: Create MessageInput Component

**Goal:** Build input component for composing and sending messages.

**Files to Create:**
- `src/lib/components/messages/MessageInput.svelte` - Message input form

**Implementation Steps:**

1. Create textarea for message text
2. Add attachment button (file upload)
3. Show attachment previews (filename, size)
4. Validate message (not empty or only attachments)
5. Send message on Enter key (Shift+Enter for new line)
6. Send message on button click
7. Show loading state while sending
8. Clear input after successful send
9. Emit `messageSent` event

**Architecture Guidance:**

- **Component Props:**
  - `conversationId: string`

- **Component Events:**
  - `messageSent` - Emitted after message sent, passes Message object

- **Keyboard Handling:**
  ```svelte
  <textarea 
    on:keydown={handleKeyDown}
    bind:value={messageText}
  />
  
  <script>
    function handleKeyDown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }
  </script>
  ```

**Verification Checklist:**

- [ ] Textarea resizes automatically
- [ ] Enter key sends message
- [ ] Shift+Enter adds new line
- [ ] Attachment button opens file picker
- [ ] Shows attachment preview after selection
- [ ] Can remove attachments before sending
- [ ] Send button disabled if empty (unless attachments)
- [ ] Loading state shows while sending
- [ ] Clears input after send

**Commit Message Template:**
```
feat(messages): create MessageInput component

- Add textarea with auto-resize
- Support Enter to send, Shift+Enter for newline
- Add attachment upload button
- Show attachment previews
- Validate message before send
- Emit messageSent event

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 5: Create NewConversation Component

**Goal:** Build UI for starting new conversations (1-on-1 or group).

**Files to Create:**
- `src/lib/components/messages/NewConversation.svelte` - New conversation form

**Implementation Steps:**

1. Create user selection dropdown (autocomplete)
2. Fetch all ApprovedUsers for selection
3. Support multi-select for group conversations
4. Add optional group title field (shown if > 2 participants)
5. Add textarea for first message
6. Call `createConversation` service on submit
7. Redirect to new conversation thread after creation

**Architecture Guidance:**

- **User Autocomplete:**
  - Fetch all users from backend (or Cognito)
  - Filter as user types
  - Show displayName and email
  - Allow multiple selections

- **Group Detection:**
  ```svelte
  $: isGroup = selectedUsers.length > 1;
  ```

**Verification Checklist:**

- [ ] User dropdown shows all ApprovedUsers
- [ ] Can select multiple users
- [ ] Group title field appears if > 2 participants
- [ ] First message required
- [ ] Creates conversation on submit
- [ ] Redirects to new thread
- [ ] Handles errors (e.g., user not found)

**Commit Message Template:**
```
feat(messages): create NewConversation component

- Add user selection dropdown with autocomplete
- Support multi-select for group conversations
- Add optional group title field
- Include first message textarea
- Create conversation and redirect to thread

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Task 6: Create Messages Inbox Page

**Goal:** Create main messages page at `/messages` showing conversation list.

**Files to Create:**
- `src/routes/messages/+page.svelte` - Messages inbox

**Implementation Steps:**

1. Create route at `/messages`
2. Require authentication (redirect if not logged in)
3. Render ConversationList component
4. Handle conversationSelected event → navigate to thread
5. Add "New Message" button → navigate to `/messages/new`

**Architecture Guidance:**

```svelte
<script>
  import ConversationList from '$lib/components/messages/ConversationList.svelte';
  import { goto } from '$app/navigation';
  
  function handleConversationSelected(event) {
    goto(`/messages/${event.detail.conversationId}`);
  }
</script>

<h1>Messages</h1>
<button on:click={() => goto('/messages/new')}>New Message</button>
<ConversationList on:conversationSelected={handleConversationSelected} />
```

**Verification Checklist:**

- [ ] Page accessible at `/messages`
- [ ] Requires authentication
- [ ] Displays ConversationList
- [ ] Clicking conversation navigates to thread
- [ ] "New Message" button navigates to new conversation page

**Commit Message Template:**
```
feat(messages): create messages inbox page

- Add /messages route
- Render ConversationList component
- Handle navigation to threads
- Add "New Message" button

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Task 7: Create Message Thread Page

**Goal:** Create page at `/messages/[conversationId]` for viewing message threads.

**Files to Create:**
- `src/routes/messages/[conversationId]/+page.svelte` - Message thread page

**Implementation Steps:**

1. Create dynamic route with `[conversationId]` parameter
2. Render MessageThread and MessageInput components
3. Handle messageSent event → add to thread optimistically
4. Implement polling for new messages (30 seconds)
5. Update unread count in parent (ConversationList) when viewing

**Architecture Guidance:**

```svelte
<script>
  import { page } from '$app/stores';
  import MessageThread from '$lib/components/messages/MessageThread.svelte';
  import MessageInput from '$lib/components/messages/MessageInput.svelte';
  
  $: conversationId = $page.params.conversationId;
  
  let messages = [];
  
  function handleMessageSent(event) {
    messages = [...messages, event.detail];
  }
  
  // Polling for new messages
  onMount(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const latest = await getMessages(conversationId, 10);
      // Add new messages...
    }, 30000);
    
    return () => clearInterval(interval);
  });
</script>

<MessageThread {conversationId} bind:messages />
<MessageInput {conversationId} on:messageSent={handleMessageSent} />
```

**Verification Checklist:**

- [ ] Page accessible at `/messages/{conversationId}`
- [ ] Displays MessageThread and MessageInput
- [ ] Sent messages appear immediately
- [ ] Polls for new messages every 30 seconds
- [ ] Auto-scrolls to bottom on new message
- [ ] Marks conversation as read on mount

**Commit Message Template:**
```
feat(messages): create message thread page

- Add /messages/[conversationId] dynamic route
- Render MessageThread and MessageInput components
- Handle messageSent with optimistic updates
- Poll for new messages every 30 seconds
- Auto-scroll on new messages

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 8: Create New Conversation Page

**Goal:** Create page at `/messages/new` for starting new conversations.

**Files to Create:**
- `src/routes/messages/new/+page.svelte` - New conversation page

**Implementation Steps:**

1. Create route at `/messages/new`
2. Render NewConversation component
3. Handle conversation created → redirect to thread

**Architecture Guidance:**

```svelte
<script>
  import NewConversation from '$lib/components/messages/NewConversation.svelte';
  import { goto } from '$app/navigation';
  
  function handleConversationCreated(event) {
    goto(`/messages/${event.detail.conversationId}`);
  }
</script>

<h1>New Message</h1>
<NewConversation on:conversationCreated={handleConversationCreated} />
```

**Verification Checklist:**

- [ ] Page accessible at `/messages/new`
- [ ] Requires authentication
- [ ] Displays NewConversation component
- [ ] Redirects to thread after creation

**Commit Message Template:**
```
feat(messages): create new conversation page

- Add /messages/new route
- Render NewConversation component
- Redirect to thread after creation

Estimated tokens: ~4000
```

**Estimated Tokens: ~4000**

---

## Task 9: Add Messages Link to Site Navigation

**Goal:** Add "Messages" link to site header with unread count badge.

**Files to Modify:**
- Site header/navigation component

**Implementation Steps:**

1. Locate site header component
2. Add "Messages" link for authenticated users
3. Fetch total unread count
4. Display badge if unread > 0
5. Update badge when new messages arrive (via polling or event)

**Architecture Guidance:**

- **Unread Count Store:**
  ```typescript
  // src/lib/stores/messages.ts
  import { writable } from 'svelte/store';
  
  export const unreadCount = writable(0);
  
  export async function updateUnreadCount() {
    const conversations = await getConversations();
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    unreadCount.set(total);
  }
  ```

- **Header Usage:**
  ```svelte
  <a href="/messages">
    Messages
    {#if $unreadCount > 0}
      <span class="badge">{$unreadCount}</span>
    {/if}
  </a>
  ```

**Verification Checklist:**

- [ ] "Messages" link appears in header
- [ ] Unread count badge displays if > 0
- [ ] Badge updates when new messages arrive
- [ ] Badge disappears when all read

**Commit Message Template:**
```
feat(messages): add messages link to navigation

- Add "Messages" link to site header
- Display unread count badge
- Update badge on new messages
- Create unreadCount store for state management

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 10: Implement Attachment Upload and Display

**Goal:** Build complete attachment functionality (upload, preview, download).

**Files to Modify:**
- `src/lib/components/messages/MessageInput.svelte` - Add upload UI
- `src/lib/components/messages/MessageThread.svelte` - Display attachments
- `src/lib/services/messageService.ts` - Upload logic

**Implementation Steps:**

1. In MessageInput: Add file input, allow multiple files
2. Show file previews (name, size, type icon)
3. Upload to S3 on message send (not before)
4. In MessageThread: Display attachments as clickable links
5. For images: Show thumbnail preview
6. For documents: Show file icon + filename
7. Generate presigned download URLs

**Architecture Guidance:**

- **Upload Flow:**
  1. User selects files
  2. Files stored in component state
  3. On send, call `uploadAttachment(file)` for each
  4. Get S3 key from upload response
  5. Include attachments array in `sendMessage` call

- **Image Thumbnail:**
  ```svelte
  {#if attachment.contentType.startsWith('image/')}
    <img src={attachment.thumbnailUrl || attachment.url} alt={attachment.filename} />
  {:else}
    <a href={attachment.url} download>{attachment.filename}</a>
  {/if}
  ```

**Verification Checklist:**

- [ ] Can select multiple files
- [ ] Shows file previews before send
- [ ] Uploads files to S3 on send
- [ ] Attachments display in message thread
- [ ] Images show thumbnails
- [ ] Documents show as download links
- [ ] Validates file size (max 25MB per file)

**Commit Message Template:**
```
feat(messages): implement attachment upload and display

- Add file input to MessageInput
- Show file previews before send
- Upload files to S3 via presigned URLs
- Display attachments in MessageThread
- Show image thumbnails
- Provide download links for documents

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Task 11: Add DM Notification Email Template

**Goal:** Create HTML email template for new direct message notifications.

**Files to Create:**
- `lambdas/notification-processor/templates/dm_notification.html` - Email template

**Prerequisites:**
- Phase 1 Task 7 complete (notification-processor Lambda exists)

**Implementation Steps:**

1. Create HTML email template with placeholders
2. Include sender name, message preview, conversation link
3. Style with inline CSS
4. Update notification-processor Lambda to use template

**Architecture Guidance:**

```html
<p>Hi there,</p>
<p><strong>{senderName}</strong> sent you a message:</p>
<blockquote>{messagePreview}</blockquote>
<a href="{conversationUrl}">View conversation</a>
```

**Verification Checklist:**

- [ ] HTML template created
- [ ] Inline CSS styling
- [ ] Plain text version included
- [ ] Lambda updated to use template
- [ ] Test email sent successfully

**Commit Message Template:**
```
feat(notifications): create DM email template

- Design HTML email for new message notifications
- Add inline CSS
- Include plain text fallback
- Update notification-processor to send DM emails

Estimated tokens: ~4000
```

**Estimated Tokens: ~4000**

---

## Task 12: Add Mobile-Responsive Design for Messages

**Goal:** Ensure messaging UI works well on mobile devices.

**Files to Modify:**
- All message components (adjust CSS)

**Implementation Steps:**

1. Test on mobile viewports (320px - 768px)
2. Adjust conversation list for narrow screens
3. Make message bubbles responsive
4. Ensure input doesn't get hidden by keyboard
5. Test attachment display on mobile

**Architecture Guidance:**

- **Mobile Considerations:**
  - Stack message bubbles full-width on narrow screens
  - Reduce padding/margins
  - Make tap targets min 44x44px
  - Position input fixed at bottom (avoid keyboard overlap)

**Verification Checklist:**

- [ ] Conversation list readable on 320px
- [ ] Message bubbles display correctly on mobile
- [ ] Input accessible even with keyboard open
- [ ] Attachment buttons large enough to tap
- [ ] No horizontal scrolling

**Commit Message Template:**
```
feat(messages): add mobile-responsive design

- Adjust layout for narrow screens
- Stack message bubbles full-width on mobile
- Fix input positioning with keyboard
- Ensure tap targets are touch-friendly

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Phase Verification

Before proceeding to Phase 5, verify:

### Functionality
- [ ] Can view inbox (conversation list)
- [ ] Can create 1-on-1 conversations
- [ ] Can create group conversations
- [ ] Can send text messages
- [ ] Can send attachments (images, documents)
- [ ] Messages appear in thread chronologically
- [ ] Unread counts display correctly
- [ ] Email notifications sent for new DMs
- [ ] Can mark conversations as read

### UI/UX
- [ ] Message threads scroll to bottom on load
- [ ] Own messages aligned right, others left
- [ ] Attachments display as thumbnails or links
- [ ] Typing in textarea feels responsive
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Loading states show appropriately

### Navigation
- [ ] "Messages" link in header works
- [ ] Unread badge updates correctly
- [ ] Can navigate between inbox and threads
- [ ] "New Message" button accessible

### Mobile
- [ ] All messaging UI works on 320px width
- [ ] Input doesn't get hidden by keyboard
- [ ] Tap targets are touch-friendly

---

## Known Limitations & Technical Debt

**Limitations:**

1. **No read receipts:** Cannot see if recipient read message
   - **Future:** Add read timestamps per message

2. **No typing indicators:** Cannot see when someone is typing
   - **Future:** Requires WebSocket or frequent polling

3. **Asynchronous delivery:** Messages not instant (30s polling)
   - **Acceptable:** Email notifications bridge the gap

4. **No message search:** Cannot search messages by keyword
   - **Future:** Add full-text search

5. **No message editing/deletion:** Once sent, cannot change
   - **Future:** Add edit/delete (with audit trail)

**Technical Debt:**

- Polling every 30 seconds for all open threads (inefficient)
  - **Refactor:** Use exponential backoff or WebSocket

- Attachment uploads block message send
  - **Refactor:** Upload in background, send message with "uploading..." placeholder

---

## Next Steps

Proceed to **Phase 5: Polish & Launch** for final testing, optimization, and deployment.
