import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', { name: 'Rappel du jour', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function scheduleEveningReminder(body: string,hour=19,minute=0) {
  const ok = await requestNotificationPermission();
  if (!ok) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({ content: { title: 'Student Planner', body, sound: undefined }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute } });
  return true;
}

export async function cancelEveningReminder(){await Notifications.cancelAllScheduledNotificationsAsync();}
