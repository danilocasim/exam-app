// notification.service.ts — Local push notifications for cooldown expiry (FREE tier only)
import * as Notifications from 'expo-notifications';

// Notification identifiers for cancellation
const DAILY_NOTIFICATION_ID = 'daily-quiz-available';
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
 * Schedule a local notification for when a cooldown expires.
 * Cancels any existing notification for the same mode before scheduling.
 *
 * @param mode - 'daily' or 'missed'
 */
export async function scheduleCooldownNotification(mode: 'daily' | 'missed'): Promise<void> {
  try {
    const hasPermission = await ensurePermissions();
    if (!hasPermission) return;

    const notificationId = mode === 'daily' ? DAILY_NOTIFICATION_ID : MISSED_NOTIFICATION_ID;

    // Cancel any previously scheduled notification for this mode
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});

    const title = mode === 'daily' ? 'Daily Quiz Available!' : 'Missed Questions Ready!';

    const body =
      mode === 'daily'
        ? "Your Daily Quiz has refreshed — keep your streak alive and sharpen your skills. Let's go!"
        : 'Your Missed Questions quiz is ready. Revisit the ones you got wrong and turn them into strengths!';

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title,
        body,
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
    console.warn(`[Notifications] Failed to schedule ${mode} notification:`, err);
  }
}

/**
 * Cancel a scheduled cooldown notification (e.g. when user is upgraded to premium).
 */
export async function cancelCooldownNotification(mode: 'daily' | 'missed'): Promise<void> {
  try {
    const notificationId = mode === 'daily' ? DAILY_NOTIFICATION_ID : MISSED_NOTIFICATION_ID;
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore — notification may not exist
  }
}

/**
 * Cancel all scheduled cooldown notifications.
 */
export async function cancelAllCooldownNotifications(): Promise<void> {
  await cancelCooldownNotification('daily');
  await cancelCooldownNotification('missed');
}
