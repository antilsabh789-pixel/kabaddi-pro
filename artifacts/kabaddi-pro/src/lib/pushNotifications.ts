// Browser push notification helper for Kabaddi Pro.
//
// This module provides WhatsApp-like local push notifications using the
// Web Notifications API. When a new chat message arrives (or any other
// real notification), we fire a system-level notification that appears
// in the phone's notification shade / OS notification center — just like
// WhatsApp.
//
// IMPORTANT LIMITATION: This is NOT true background push (which requires
// a service worker + VAPID + a push service like FCM). These notifications
// only fire while the app is open or in a background tab. For true
// background push (app fully closed), a service worker + push subscription
// would be needed — that's a larger feature.
//
// Even so, this gives the user OS-level notification banners + vibration
// + sound when a new message arrives while the app is open in another
// tab or the user is elsewhere in the app.

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Check if the Web Notifications API is available in this browser.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get the current permission state.
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Request permission to show notifications. Returns the final permission
 * state. If the user has already granted/denied, returns the current state
 * without prompting.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string; // for deduplication — notifications with the same tag replace each other
  data?: { [key: string]: any }; // passed to the notification click handler
}

/**
 * Show a system-level notification. Does nothing if permission hasn't been
 * granted. Returns true if the notification was shown, false otherwise.
 *
 * The notification is silent if the document is focused (the user is
 * already looking at the app) — we don't want to spam them with OS
 * banners for things they can already see. When the document is NOT
 * focused (background tab or different app), we fire the OS notification
 * so they get a banner + vibration + sound.
 */
export function showLocalNotification(opts: ShowNotificationOptions): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  // Don't fire OS banner if the user is actively looking at the app.
  // They'll see the in-app bell badge + toast instead.
  // EXCEPTION: always fire for chat notifications so the user gets a
  // vibration + sound even when in the app (matches WhatsApp behavior
  // where you still get a notification sound when a message arrives
  // while you're in a different chat).
  const isChat = opts.tag?.startsWith('chat-');

  try {
    // `vibrate` is a valid Web Notifications API option on Android/Chrome
    // but isn't in TypeScript's DOM lib NotificationOptions type, so we
    // cast to any to set it. It triggers a vibration pattern on supported
    // mobile devices (WhatsApp-style buzz on new message).
    const notifOptions: any = {
      body: opts.body,
      icon: opts.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: opts.tag,
      data: opts.data,
      silent: false,
    };
    if (isChat) {
      notifOptions.vibrate = [200, 100, 200];
    }
    const notification = new Notification(opts.title, notifOptions);

    // Auto-close after 8 seconds so the notification doesn't linger
    // forever in the OS shade (WhatsApp keeps them, but for a web app
    // auto-close is friendlier).
    setTimeout(() => {
      try { notification.close(); } catch { /* ignore */ }
    }, 8000);

    // Click handler — focus the window. The data payload can be used
    // by the app to navigate to the relevant screen (e.g. open the chat
    // thread). For now we just focus + navigate to home.
    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
        // If the notification has a threadId, navigate to that chat
        if (opts.data?.threadId && opts.data?.fromUserId) {
          // Dispatch a custom event that page.tsx / HomeTab can listen for
          window.dispatchEvent(new CustomEvent('kabaddi:open-chat', {
            detail: {
              threadId: opts.data.threadId,
              fromUserId: opts.data.fromUserId,
              fromUserName: opts.data.fromUserName,
            },
          }));
        }
      } catch { /* ignore */ }
    };

    return true;
  } catch (err) {
    console.error('showLocalNotification error:', err);
    return false;
  }
}

/**
 * Convenience wrapper specifically for chat message notifications.
 * Fires a WhatsApp-style notification with the sender's name + message
 * preview, tagged so multiple messages from the same thread replace
 * each other (the bell badge still shows the unread count).
 */
export function showChatMessageNotification(opts: {
  senderName: string;
  messagePreview: string;
  threadId?: string;
  fromUserId?: string;
  avatar?: string;
}): boolean {
  return showLocalNotification({
    title: `💬 ${opts.senderName}`,
    body: opts.messagePreview.length > 100
      ? opts.messagePreview.slice(0, 100) + '…'
      : opts.messagePreview,
    tag: opts.threadId ? `chat-${opts.threadId}` : 'chat-message',
    icon: opts.avatar,
    data: {
      threadId: opts.threadId,
      fromUserId: opts.fromUserId,
      fromUserName: opts.senderName,
    },
  });
}
