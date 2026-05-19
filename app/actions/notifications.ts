"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const ChannelSchema = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
});

const PrefsSchema = z.record(z.string(), ChannelSchema);

export type ChannelPrefs = z.infer<typeof ChannelSchema>;
export type NotificationPrefs = z.infer<typeof PrefsSchema>;

export async function getNotificationPreferences(): Promise<{ prefs?: NotificationPrefs; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const { data, error } = await supabase.rpc("get_notification_preferences");
    if (error) {
      log.error("getNotificationPreferences failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    return { prefs: (data ?? {}) as NotificationPrefs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setNotificationPreferences(prefs: NotificationPrefs): Promise<{ success?: true; error?: string }> {
  const parse = PrefsSchema.safeParse(prefs);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Invalid preferences" };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const { error } = await supabase.rpc("set_notification_preferences", { p_prefs: parse.data });
    if (error) {
      log.error("setNotificationPreferences failed", { code: error.code, message: error.message });
      return { error: error.message };
    }
    revalidatePath("/dashboard/owner/settings/notifications");
    revalidatePath("/dashboard/profile/notifications");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
