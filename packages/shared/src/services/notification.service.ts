// notification.service.ts — Local push notifications for cooldown expiry (FREE tier only)
import * as Notifications from 'expo-notifications';

// Notification identifiers for cancellation
const MISSED_NOTIFICATION_ID = 'missed-question-available';

// 24-hour cooldown in seconds
const COOLDOWN_SECONDS = 24 * 60 * 60;

/**
 * Configure notification handler behaviour (call once at app startup).
 * Ensures notifications display even while the app is foregrounded.
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions (idempotent — safe to call multiple times).
 * Returns true if notifications are allowed.
 */
async function ensurePermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification for when the missed questions cooldown expires.
 * Cancels any existing notification before scheduling.
 */
export async function scheduleCooldownNotification(_mode: 'missed'): Promise<void> {
  try {
    const hasPermission = await ensurePermissions();
    if (!hasPermission) return;

    // Cancel any previously scheduled notification
    await Notifications.cancelScheduledNotificationAsync(MISSED_NOTIFICATION_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: MISSED_NOTIFICATION_ID,
      content: {
        title: 'Missed Questions Ready!',
        body: 'Your Missed Questions quiz is ready. Revisit the ones you got wrong and turn them into strengths!',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: COOLDOWN_SECONDS,
        repeats: false,
      },
    });
  } catch (err) {
    // Non-blocking — notification is a nice-to-have
    console.warn(`[Notifications] Failed to schedule missed notification:`, err);
  }
}

/**
 * Cancel a scheduled cooldown notification.
 */
export async function cancelCooldownNotification(_mode: 'missed'): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MISSED_NOTIFICATION_ID);
  } catch {
    // Ignore — notification may not exist
  }
}

/**
 * Cancel all scheduled cooldown notifications.
 */
export async function cancelAllCooldownNotifications(): Promise<void> {
  await cancelCooldownNotification('missed');
}
