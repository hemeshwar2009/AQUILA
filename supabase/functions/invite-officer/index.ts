// Aquila: invite a new command-center officer.
// Only an active admin may call this. It sends Supabase's invite email and
// creates the matching row in public.admins. Runs server-side, so the
// service-role key never reaches the browser.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function →
// name it "invite-officer" → paste this file. (Or: supabase functions deploy invite-officer)
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // who is calling?
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: me } = await admin
      .from("admins").select("name, disabled, accepted_at").eq("user_id", user.id).maybeSingle();
    if (!me || me.disabled || !me.accepted_at) return json({ error: "Only active admins can invite officers." }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim().slice(0, 40);
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
    if (name.length < 2) return json({ error: "Enter the officer's full name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);

    const { data: existing } = await admin.from("admins").select("user_id").eq("email", email).maybeSingle();
    if (existing) return json({ error: "That email already has an admin account or a pending invite." }, 409);

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name } });
    if (error || !data?.user) return json({ error: error?.message ?? "Could not send the invite." }, 400);

    const { error: insertError } = await admin.from("admins").insert({
      user_id: data.user.id, email, name, created_by: me.name,
    });
    if (insertError) return json({ error: insertError.message }, 400);

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
