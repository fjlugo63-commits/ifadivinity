import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is seller (Awo) or admin
    const { data: profile } = await supabase
      .from("app_340b9f1944_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Only Awo practitioners can view consultation history" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET") {
      // ACTION: history - Get all past consultations for the Awo
      if (action === "history") {
        const search = url.searchParams.get("search") || "";
        const dateFrom = url.searchParams.get("date_from") || "";
        const dateTo = url.searchParams.get("date_to") || "";
        const oduFilter = url.searchParams.get("odu") || "";
        const outcomeFilter = url.searchParams.get("outcome") || "";
        const clientFilter = url.searchParams.get("client_id") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = (page - 1) * limit;

        let query = supabase
          .from("app_340b9f1944_consultations")
          .select("*", { count: "exact" })
          .eq("awo_id", user.id)
          .in("status", ["completed", "cancelled"])
          .order("scheduled_at", { ascending: false });

        // Search by client name
        if (search) {
          query = query.ilike("client_name", `%${search}%`);
        }

        // Filter by client_id
        if (clientFilter) {
          query = query.eq("client_id", clientFilter);
        }

        // Date range filters
        if (dateFrom) {
          query = query.gte("scheduled_at", dateFrom);
        }
        if (dateTo) {
          query = query.lte("scheduled_at", dateTo);
        }

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data: consultations, error, count } = await query;

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If Odu or outcome filter is specified, we need to cross-reference
        let filteredConsultations = consultations || [];

        if (oduFilter && filteredConsultations.length > 0) {
          const consultationIds = filteredConsultations.map(c => c.id);
          const { data: oduData } = await supabase
            .from("app_340b9f1944_consultation_odu")
            .select("consultation_id, odu:app_340b9f1944_odu_reference(name)")
            .in("consultation_id", consultationIds);

          if (oduData) {
            const matchingIds = oduData
              .filter(o => o.odu && o.odu.name.toLowerCase().includes(oduFilter.toLowerCase()))
              .map(o => o.consultation_id);
            filteredConsultations = filteredConsultations.filter(c => matchingIds.includes(c.id));
          }
        }

        if (outcomeFilter && filteredConsultations.length > 0) {
          const consultationIds = filteredConsultations.map(c => c.id);
          const { data: outcomeData } = await supabase
            .from("app_340b9f1944_ire_osogbo")
            .select("consultation_id, outcome_type")
            .in("consultation_id", consultationIds);

          if (outcomeData) {
            const matchingIds = outcomeData
              .filter(o => o.outcome_type === outcomeFilter)
              .map(o => o.consultation_id);
            filteredConsultations = filteredConsultations.filter(c => matchingIds.includes(c.id));
          }
        }

        return new Response(JSON.stringify({
          consultations: filteredConsultations,
          total: oduFilter || outcomeFilter ? filteredConsultations.length : (count || 0),
          page,
          limit,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ACTION: details - Get full details of a single consultation
      if (action === "details") {
        const consultationId = url.searchParams.get("consultation_id");
        if (!consultationId) {
          return new Response(JSON.stringify({ error: "consultation_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify ownership
        const { data: consultation, error: consultError } = await supabase
          .from("app_340b9f1944_consultations")
          .select("*")
          .eq("id", consultationId)
          .eq("awo_id", user.id)
          .single();

        if (consultError || !consultation) {
          return new Response(JSON.stringify({ error: "Consultation not found or access denied" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch Odu
        const { data: oduData } = await supabase
          .from("app_340b9f1944_consultation_odu")
          .select("*, odu:app_340b9f1944_odu_reference(*)")
          .eq("consultation_id", consultationId)
          .single();

        // Fetch Ire/Osogbo
        const { data: outcomeData } = await supabase
          .from("app_340b9f1944_ire_osogbo")
          .select("*")
          .eq("consultation_id", consultationId)
          .single();

        // Fetch Ebo
        const { data: eboData } = await supabase
          .from("app_340b9f1944_ebo")
          .select("*")
          .eq("consultation_id", consultationId)
          .single();

        // Fetch Notes
        const { data: notesData } = await supabase
          .from("app_340b9f1944_consultation_notes")
          .select("*")
          .eq("consultation_id", consultationId)
          .single();

        // Fetch Summary
        const { data: summaryData } = await supabase
          .from("app_340b9f1944_consultation_summary")
          .select("*")
          .eq("consultation_id", consultationId)
          .single();

        return new Response(JSON.stringify({
          consultation,
          odu: oduData || null,
          outcome: outcomeData || null,
          ebo: eboData || null,
          notes: notesData || null,
          summary: summaryData || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});