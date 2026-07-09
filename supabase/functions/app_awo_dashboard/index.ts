import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Get user from auth header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify user
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
    authHeader.replace("Bearer ", "")
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user is a seller (Awo role)
  const { data: profile } = await supabaseAdmin
    .from("app_340b9f1944_profiles")
    .select("role, verified_egbo")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
    return new Response(JSON.stringify({ error: "Access denied. Awo role required." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop() || "";
  const action = url.searchParams.get("action") || path;

  try {
    // GET /upcoming-consultations
    if (req.method === "GET" && action === "upcoming-consultations") {
      const { data, error } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .select("*")
        .eq("awo_id", user.id)
        .gte("scheduled_at", new Date().toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("scheduled_at", { ascending: true })
        .limit(20);

      if (error) throw error;

      return new Response(JSON.stringify({ consultations: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /notifications
    if (req.method === "GET" && action === "notifications") {
      const { data, error } = await supabaseAdmin
        .from("app_340b9f1944_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(JSON.stringify({ notifications: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /notifications/mark-read
    if (req.method === "PATCH" && action === "mark-read") {
      const body = await req.json();
      const { notification_ids } = body;

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return new Response(JSON.stringify({ error: "notification_ids array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("app_340b9f1944_notifications")
        .update({ is_read: true })
        .in("id", notification_ids)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /notifications/clear-all
    if (req.method === "PATCH" && action === "clear-all") {
      const { error } = await supabaseAdmin
        .from("app_340b9f1944_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /house-visibility (entitlement-gated)
    if (req.method === "GET" && action === "house-visibility") {
      // Check if user belongs to a house
      const { data: membership } = await supabaseAdmin
        .from("app_340b9f1944_house_practitioners")
        .select("house_id, role")
        .eq("practitioner_id", user.id)
        .limit(1)
        .single();

      if (!membership) {
        return new Response(JSON.stringify({ 
          has_house: false, 
          message: "Not a member of any Ifa House" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check entitlement
      const { data: entitlement } = await supabaseAdmin
        .from("app_340b9f1944_subscription_entitlements")
        .select("*")
        .eq("house_id", membership.house_id)
        .eq("entitlement_key", "house_visibility")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!entitlement) {
        return new Response(JSON.stringify({ 
          has_house: true, 
          entitled: false, 
          message: "House visibility requires Ifa House subscription" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get house info
      const { data: house } = await supabaseAdmin
        .from("app_340b9f1944_ifa_houses")
        .select("*")
        .eq("id", membership.house_id)
        .single();

      // Get house-wide upcoming consultations
      const { data: houseMembers } = await supabaseAdmin
        .from("app_340b9f1944_house_practitioners")
        .select("practitioner_id")
        .eq("house_id", membership.house_id);

      const memberIds = (houseMembers || []).map((m) => m.practitioner_id);

      const { data: houseConsultations } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .select("*")
        .in("awo_id", memberIds)
        .gte("scheduled_at", new Date().toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("scheduled_at", { ascending: true })
        .limit(20);

      // Get house announcements
      const { data: announcements } = await supabaseAdmin
        .from("app_340b9f1944_house_announcements")
        .select("*")
        .eq("house_id", membership.house_id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Get shared records requiring review (consultations with status 'review')
      const { data: reviewRecords } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .select("*")
        .in("awo_id", memberIds)
        .eq("status", "review")
        .order("updated_at", { ascending: false })
        .limit(10);

      return new Response(JSON.stringify({
        has_house: true,
        entitled: true,
        house,
        house_consultations: houseConsultations || [],
        announcements: announcements || [],
        review_records: reviewRecords || [],
        member_role: membership.role,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /consultations (create new consultation)
    if (req.method === "POST" && action === "create-consultation") {
      const body = await req.json();
      const { client_name, consultation_type, scheduled_at, duration_minutes, notes } = body;

      if (!client_name || !scheduled_at) {
        return new Response(JSON.stringify({ error: "client_name and scheduled_at required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .insert({
          awo_id: user.id,
          client_name,
          consultation_type: consultation_type || "general",
          scheduled_at,
          duration_minutes: duration_minutes || 60,
          notes: notes || null,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /consultations/reschedule
    if (req.method === "PATCH" && action === "reschedule") {
      const body = await req.json();
      const { consultation_id, new_scheduled_at } = body;

      if (!consultation_id || !new_scheduled_at) {
        return new Response(JSON.stringify({ error: "consultation_id and new_scheduled_at required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .update({ scheduled_at: new_scheduled_at, updated_at: new Date().toISOString() })
        .eq("id", consultation_id)
        .eq("awo_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /consultations/cancel
    if (req.method === "PATCH" && action === "cancel") {
      const body = await req.json();
      const { consultation_id } = body;

      if (!consultation_id) {
        return new Response(JSON.stringify({ error: "consultation_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin
        .from("app_340b9f1944_consultations")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", consultation_id)
        .eq("awo_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /entitlements (check user's subscription entitlements)
    if (req.method === "GET" && action === "entitlements") {
      const { data: userEntitlements } = await supabaseAdmin
        .from("app_340b9f1944_subscription_entitlements")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      // Also check house-level entitlements
      const { data: membership } = await supabaseAdmin
        .from("app_340b9f1944_house_practitioners")
        .select("house_id")
        .eq("practitioner_id", user.id)
        .limit(1)
        .single();

      let houseEntitlements: any[] = [];
      if (membership) {
        const { data } = await supabaseAdmin
          .from("app_340b9f1944_subscription_entitlements")
          .select("*")
          .eq("house_id", membership.house_id)
          .eq("is_active", true);
        houseEntitlements = data || [];
      }

      return new Response(JSON.stringify({
        user_entitlements: userEntitlements || [],
        house_entitlements: houseEntitlements,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=upcoming-consultations|notifications|house-visibility|mark-read|clear-all|create-consultation|reschedule|cancel|entitlements" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});