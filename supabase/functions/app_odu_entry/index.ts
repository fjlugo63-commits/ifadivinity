import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user role - must be seller (Awo) or admin
    const { data: profile } = await supabase
      .from("app_340b9f1944_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Access denied. Awo role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET /odu-reference - Get all 256 Odu with optional search
    if (req.method === "GET" && action === "odu-reference") {
      const search = url.searchParams.get("search") || "";
      const category = url.searchParams.get("category") || "";

      let query = supabase
        .from("app_340b9f1944_odu_reference")
        .select("*")
        .order("position", { ascending: true });

      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,aliases.cs.{${search}}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ odu_list: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /consultation-odu - Get Odu for a specific consultation
    if (req.method === "GET" && action === "consultation-odu") {
      const consultationId = url.searchParams.get("consultation_id");
      if (!consultationId) {
        return new Response(JSON.stringify({ error: "consultation_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify consultation belongs to this Awo
      const { data: consultation } = await supabase
        .from("app_340b9f1944_consultations")
        .select("id, awo_id")
        .eq("id", consultationId)
        .single();

      if (!consultation || (consultation.awo_id !== user.id && profile.role !== "admin")) {
        return new Response(JSON.stringify({ error: "Consultation not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .select(`
          *,
          odu:app_340b9f1944_odu_reference(*)
        `)
        .eq("consultation_id", consultationId)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return new Response(JSON.stringify({ consultation_odu: data || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /save-odu - Save Odu to consultation (initial confirmation)
    if (req.method === "POST" && action === "save-odu") {
      const body = await req.json();
      const { consultation_id, odu_id } = body;

      if (!consultation_id || !odu_id) {
        return new Response(JSON.stringify({ error: "consultation_id and odu_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify consultation belongs to this Awo
      const { data: consultation } = await supabase
        .from("app_340b9f1944_consultations")
        .select("id, awo_id, status")
        .eq("id", consultation_id)
        .single();

      if (!consultation || consultation.awo_id !== user.id) {
        return new Response(JSON.stringify({ error: "Consultation not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if Odu already exists for this consultation
      const { data: existing } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .select("id")
        .eq("consultation_id", consultation_id)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: "Odu already recorded for this consultation. Use update action instead." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify odu_id exists
      const { data: odu } = await supabase
        .from("app_340b9f1944_odu_reference")
        .select("id, name")
        .eq("id", odu_id)
        .single();

      if (!odu) {
        return new Response(JSON.stringify({ error: "Invalid odu_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert consultation_odu record
      const { data: inserted, error } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .insert({
          consultation_id,
          odu_id,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        })
        .select(`
          *,
          odu:app_340b9f1944_odu_reference(*)
        `)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation_odu: inserted, message: "Odu confirmed and saved successfully" }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /update-odu - Update Odu for a consultation (requires re-confirmation)
    if (req.method === "PUT" && action === "update-odu") {
      const body = await req.json();
      const { consultation_id, odu_id, update_reason } = body;

      if (!consultation_id || !odu_id) {
        return new Response(JSON.stringify({ error: "consultation_id and odu_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify consultation belongs to this Awo
      const { data: consultation } = await supabase
        .from("app_340b9f1944_consultations")
        .select("id, awo_id")
        .eq("id", consultation_id)
        .single();

      if (!consultation || consultation.awo_id !== user.id) {
        return new Response(JSON.stringify({ error: "Consultation not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing record
      const { data: existing } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .select("id, odu_id")
        .eq("consultation_id", consultation_id)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "No existing Odu record found. Use save action instead." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify new odu_id exists
      const { data: odu } = await supabase
        .from("app_340b9f1944_odu_reference")
        .select("id, name")
        .eq("id", odu_id)
        .single();

      if (!odu) {
        return new Response(JSON.stringify({ error: "Invalid odu_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update the record with audit trail
      const { data: updated, error } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .update({
          odu_id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
          update_reason: update_reason || null,
          previous_odu_id: existing.odu_id,
        })
        .eq("id", existing.id)
        .select(`
          *,
          odu:app_340b9f1944_odu_reference(*)
        `)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation_odu: updated, message: "Odu updated successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});