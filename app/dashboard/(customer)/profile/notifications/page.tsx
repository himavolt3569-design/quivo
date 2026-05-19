import { NotificationPreferencesView } from "@/components/dashboard/NotificationPreferencesView";
import { getNotificationPreferences } from "@/app/actions/notifications";

export const dynamic = "force-dynamic";

export default async function CustomerNotificationsPrefsPage() {
  const res = await getNotificationPreferences();
  return (
    <NotificationPreferencesView
      backHref="/dashboard/profile"
      initialPrefs={res.prefs ?? {}}
    />
  );
}
