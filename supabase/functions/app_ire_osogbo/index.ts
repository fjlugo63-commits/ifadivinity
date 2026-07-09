import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

// Ire sub-types
const IRE_SUBTYPES = [
  { key: "ire_aiku", label: "Ire Aiku", meaning: "Long Life" },
  { key: "ire_owo", label: "Ire Owó", meaning: "Wealth" },
  { key: "ire_ara", label: "Ire Ará", meaning: "Health" },
  { key: "ire_ibiku", label: "Ire Ìbìkú", meaning: "Protection" },
  { key: "ire_ibasepo", label: "Ire Ìbáṣepọ̀", meaning: "Relationships" },
  { key: "ire_irina", label: "Ire Ìrìnà", meaning: "Travel" },
  { key: "ire_imo", label: "Ire Ìmọ̀", meaning: "Wisdom" },
  { key: "ire_ise", label: "Ire Ìṣẹ̀", meaning: "Work" },
  { key: "ire_idile", label: "Ire Ìdílé", meaning: "Family" },
];

// Osogbo sub-types
const OSOGBO_SUBTYPES = [
  { key: "osogbo_iku", label: "Osogbo Ikú", meaning: "Death" },
  { key: "osogbo_arun", label: "Osogbo Arun", meaning: "Illness" },
  { key: "osogbo_epe", label: "Osogbo Epe", meaning: "Curse" },
  { key: "osogbo_ofo", label: "Osogbo Ofo", meaning: "Loss" },
  { key: "osogbo_ewon", label: "Osogbo Ewon", meaning: "Imprisonment" },
  { key: "osogbo_ogu", label: "Osogbo Ogu", meaning: "Conflict" },
  { key: "osogbo_ija", label: "Osogbo Ija", meaning: "Fight" },
  { key: "osogbo_iponri", label: "Osogbo Iponri", meaning: "Destiny Misalignment" },
  { key: "osogbo_osi", label: "Osogbo Osi", meaning: "Poverty" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role (must be seller/admin = Awo)
    const { data: profile } = await supabase
      .from("app_340b9f1944_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["seller", "admin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Only Awo practitioners can access this" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: Fetch sub-types reference data
    if (req.method === "GET" && action === "subtypes") {
      return new Response(JSON.stringify({ ire_subtypes: IRE_SUBTYPES, osogbo_subtypes: OSOGBO_SUBTYPES }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Fetch current outcome for a consultation
    if (req.method === "GET" && action === "consultation-outcome") {
      const consultationId = url.searchParams.get("consultation_id");
      if (!consultationId) {
        return new Response(JSON.stringify({ error: "consultation_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("app_340b9f1944_ire_osogbo")
        .select("*")
        .eq("consultation_id", consultationId)
        .maybeSingle();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ outcome: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Save initial outcome
    if (req.method === "POST" && action === "save-outcome") {
      const body = await req.json();
      const { consultation_id, outcome_type, outcome_subtype } = body;

      if (!consultation_id || !outcome_type || !outcome_subtype) {
        return new Response(JSON.stringify({ error: "consultation_id, outcome_type, and outcome_subtype required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate outcome_type
      if (!["ire", "osogbo"].includes(outcome_type)) {
        return new Response(JSON.stringify({ error: "outcome_type must be 'ire' or 'osogbo'" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate subtype
      const validSubtypes = outcome_type === "ire"
        ? IRE_SUBTYPES.map(s => s.key)
        : OSOGBO_SUBTYPES.map(s => s.key);
      if (!validSubtypes.includes(outcome_subtype)) {
        return new Response(JSON.stringify({ error: "Invalid outcome_subtype" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify consultation belongs to this Awo and is active
      const { data: consultation } = await supabase
        .from("app_340b9f1944_consultations")
        .select("id, awo_id, status")
        .eq("id", consultation_id)
        .single();

      if (!consultation || consultation.awo_id !== user.id) {
        return new Response(JSON.stringify({ error: "Consultation not found or not yours" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["scheduled", "in_progress"].includes(consultation.status)) {
        return new Response(JSON.stringify({ error: "Consultation is not active" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if Odu has been confirmed first
      const { data: oduRecord } = await supabase
        .from("app_340b9f1944_consultation_odu")
        .select("id")
        .eq("consultation_id", consultation_id)
        .maybeSingle();

      if (!oduRecord) {
        return new Response(JSON.stringify({ error: "Odu must be confirmed before setting Ire/Osogbo outcome" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if outcome already exists
      const { data: existing } = await supabase
        .from("app_340b9f1944_ire_osogbo")
        .select("id")
        .eq("consultation_id", consultation_id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Outcome already exists. Use update endpoint." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert outcome
      const { data: outcome, error: insertError } = await supabase
        .from("app_340b9f1944_ire_osogbo")
        .insert({
          consultation_id,
          outcome_type,
          outcome_subtype,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ outcome }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Update outcome
    if (req.method === "PUT" && action === "update-outcome") {
      const body = await req.json();
      const { consultation_id, outcome_type, outcome_subtype, update_reason } = body;

      if (!consultation_id || !outcome_type || !outcome_subtype) {
        return new Response(JSON.stringify({ error: "consultation_id, outcome_type, and outcome_subtype required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate outcome_type
      if (!["ire", "osogbo"].includes(outcome_type)) {
        return new Response(JSON.stringify({ error: "outcome_type must be 'ire' or 'osogbo'" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate subtype
      const validSubtypes = outcome_type === "ire"
        ? IRE_SUBTYPES.map(s => s.key)
        : OSOGBO_SUBTYPES.map(s => s.key);
      if (!validSubtypes.includes(outcome_subtype)) {
        return new Response(JSON.stringify({ error: "Invalid outcome_subtype" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify consultation
      const { data: consultation } = await supabase
        .from("app_340b9f1944_consultations")
        .select("id, awo_id, status")
        .eq("id", consultation_id)
        .single();

      if (!consultation || consultation.awo_id !== user.id) {
        return new Response(JSON.stringify({ error: "Consultation not found or not yours" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["scheduled", "in_progress"].includes(consultation.status)) {
        return new Response(JSON.stringify({ error: "Consultation is not active" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing outcome
      const { data: existing } = await supabase
        .from("app_340b9f1944_ire_osogbo")
        .select("*")
        .eq("consultation_id", consultation_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "No existing outcome to update" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update with audit trail
      const { data: outcome, error: updateError } = await supabase
        .from("app_340b9f1944_ire_osogbo")
        .update({
          outcome_type,
          outcome_subtype,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
          update_reason: update_reason || null,
          previous_outcome_type: existing.outcome_type,
          previous_outcome_subtype: existing.outcome_subtype,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ outcome }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action or method" }), {
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