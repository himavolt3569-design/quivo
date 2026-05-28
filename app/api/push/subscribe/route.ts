import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const Body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(200),
  }),
  userAgent: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parse = Body.safeParse(payload);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Use service-role for the upsert: RLS UPDATE policy gates on the EXISTING
  // row's user_id, so a different user re-using the same browser endpoint
  // can't reclaim it through the user client. Auth was already verified above.
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parse.data.endpoint,
      p256dh: parse.data.keys.p256dh,
      auth: parse.data.keys.auth,
      user_agent: parse.data.userAgent ?? null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    log.error("push/subscribe: upsert failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "missing endpoint" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
