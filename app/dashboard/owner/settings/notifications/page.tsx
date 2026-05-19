import { NotificationPreferencesView } from "@/components/dashboard/NotificationPreferencesView";
import { getNotificationPreferences } from "@/app/actions/notifications";

export const dynamic = "force-dynamic";

export default async function OwnerNotificationsPrefsPage() {
  const res = await getNotificationPreferences();
  return (
    <NotificationPreferencesView
      backHref="/dashboard/owner/settings"
      initialPrefs={res.prefs ?? {}}
    />
  );
}
