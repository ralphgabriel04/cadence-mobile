import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ============================================================================
// End-of-rest signals (cm#27)
//
// THE NOTIFICATION IS SCHEDULED, NOT FIRED
// It is booked with the OS the moment the rest starts, for the instant the rest
// ends. It is NOT triggered by JavaScript when the countdown reaches zero --
// that code does not run when the phone is locked, which is exactly the
// situation the notification exists for. An athlete resting ninety seconds with
// the screen off gets nothing from a JS-fired notification.
//
// Everything here degrades quietly. A denied permission, a simulator with no
// haptic engine, or the web build must not break logging a workout: the timer
// itself is authoritative and the signals are a convenience on top.
// ============================================================================

const REST_CHANNEL = "rest-timer";

let configured = false;

/**
 * Foreground presentation is deliberately silent.
 *
 * When the app is open the athlete is already looking at the countdown and gets
 * the haptic; a banner over the logging screen on every set would be noise. The
 * notification still matters -- it is what reaches them when the screen is off.
 */
function configureOnce(): void {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks for permission, once, and sets up the Android channel.
 *
 * Returns whether notifications can actually be posted, so the caller can tell
 * the athlete that the timer will be silent rather than letting them find out
 * by missing a rest.
 */
export async function prepareRestNotifications(): Promise<boolean> {
  try {
    configureOnce();

    if (Platform.OS === "android") {
      // Android needs an explicit channel or the notification is silent and
      // unsorted. Naming it after the feature keeps it recognisable in system
      // settings, where the athlete can mute it without muting the whole app.
      await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
        name: "Minuteur de repos",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Books the end-of-rest notification.
 *
 * `seconds` is the time remaining, not the original duration: adjusting a
 * running timer reschedules from the new remaining time.
 *
 * Returns the identifier so it can be cancelled -- an athlete who ends their
 * rest early must not be buzzed thirty seconds later.
 */
export async function scheduleRestEnd(seconds: number): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    configureOnce();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "Repos terminé",
        body: "C'est reparti pour la prochaine série.",
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: REST_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestEnd(identifier: string | null): Promise<void> {
  if (identifier === null) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // A notification that cannot be cancelled fires once and is a minor
    // annoyance; throwing here would take the training screen down.
  }
}

/**
 * Haptic pulse when the rest ends with the app open.
 *
 * Success rather than a plain impact: it is a distinct, recognisable pattern,
 * which matters when the phone is on a bench and the athlete is not watching.
 */
export async function pulseRestEnd(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // No haptic engine (simulator, web, some Android devices). Not an error.
  }
}

/** Light tick when the athlete adjusts the countdown, for tactile confirmation. */
export async function pulseAdjust(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignored, as above.
  }
}
