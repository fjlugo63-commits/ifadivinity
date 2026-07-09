import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET /awo/clients - list all clients
    if (action === "list" && req.method === "GET") {
      const search = url.searchParams.get("search") || "";
      const filter = url.searchParams.get("filter") || "all";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = (page - 1) * limit;

      let query = supabase
        .from("app_340b9f1944_clients")
        .select("*", { count: "exact" })
        .eq("awo_id", user.id)
        .order("updated_at", { ascending: false });

      // Apply search
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      // Apply filter
      if (filter === "active") {
        query = query.eq("status", "active");
      } else if (filter === "inactive") {
        query = query.eq("status", "inactive");
      }

      query = query.range(offset, offset + limit - 1);
      const { data: clients, count, error } = await query;

      if (error) throw error;

      // Get consultation counts and last consultation dates for each client
      const clientIds = (clients || []).map((c: any) => c.id);
      let consultationStats: any[] = [];
      
      if (clientIds.length > 0) {
        const { data: stats } = await supabase
          .from("app_340b9f1944_consultations")
          .select("client_id, scheduled_at, status")
          .in("client_id", clientIds)
          .eq("awo_id", user.id);
        consultationStats = stats || [];
      }

      // Enrich clients with stats
      const enrichedClients = (clients || []).map((client: any) => {
        const clientConsultations = consultationStats.filter((s: any) => s.client_id === client.id);
        const completedConsultations = clientConsultations.filter((s: any) => 
          s.status === "completed" || s.status === "active" || s.status === "scheduled"
        );
        const lastConsultation = completedConsultations
          .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
        const upcomingConsultations = clientConsultations.filter((s: any) => 
          s.status === "scheduled" && new Date(s.scheduled_at) > new Date()
        );

        return {
          ...client,
          total_consultations: completedConsultations.length,
          last_consultation_date: lastConsultation?.scheduled_at || null,
          has_upcoming: upcomingConsultations.length > 0,
        };
      });

      // Filter by upcoming if needed
      let finalClients = enrichedClients;
      if (filter === "upcoming") {
        finalClients = enrichedClients.filter((c: any) => c.has_upcoming);
      }

      return new Response(JSON.stringify({ clients: finalClients, total: count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /awo/clients - create a new client
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { name, email, phone, timezone } = body;

      if (!name) {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check email uniqueness for this Awo
      if (email) {
        const { data: existing } = await supabase
          .from("app_340b9f1944_clients")
          .select("id")
          .eq("awo_id", user.id)
          .eq("email", email)
          .single();

        if (existing) {
          return new Response(JSON.stringify({ error: "A client with this email already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: client, error } = await supabase
        .from("app_340b9f1944_clients")
        .insert({
          awo_id: user.id,
          name,
          email: email || null,
          phone: phone || null,
          timezone: timezone || "America/New_York",
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ client }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /awo/clients/{id} - get client detail
    if (action === "detail" && req.method === "GET") {
      const clientId = url.searchParams.get("client_id");
      if (!clientId) {
        return new Response(JSON.stringify({ error: "client_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: client, error } = await supabase
        .from("app_340b9f1944_clients")
        .select("*")
        .eq("id", clientId)
        .eq("awo_id", user.id)
        .single();

      if (error || !client) {
        return new Response(JSON.stringify({ error: "Client not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ client }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /awo/clients/{id} - update client
    if (action === "update" && req.method === "PUT") {
      const body = await req.json();
      const { client_id, name, email, phone, timezone, status } = body;

      if (!client_id) {
        return new Response(JSON.stringify({ error: "client_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (timezone !== undefined) updates.timezone = timezone;
      if (status !== undefined) updates.status = status;

      const { data: client, error } = await supabase
        .from("app_340b9f1944_clients")
        .update(updates)
        .eq("id", client_id)
        .eq("awo_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ client }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /awo/clients/{id}/consultations
    if (action === "client-consultations" && req.method === "GET") {
      const clientId = url.searchParams.get("client_id");
      if (!clientId) {
        return new Response(JSON.stringify({ error: "client_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: consultations, error } = await supabase
        .from("app_340b9f1944_consultations")
        .select("*")
        .eq("client_id", clientId)
        .eq("awo_id", user.id)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;

      // Enrich with Odu, Ire/Osogbo, Ebo data
      const consultationIds = (consultations || []).map((c: any) => c.id);
      let oduData: any[] = [];
      let outcomeData: any[] = [];
      let eboData: any[] = [];

      if (consultationIds.length > 0) {
        const [oduRes, outcomeRes, eboRes] = await Promise.all([
          supabase.from("app_340b9f1944_consultation_odu").select("consultation_id, odu_name").in("consultation_id", consultationIds),
          supabase.from("app_340b9f1944_ire_osogbo").select("consultation_id, outcome_type, subtype").in("consultation_id", consultationIds),
          supabase.from("app_340b9f1944_ebo").select("consultation_id, category, status").in("consultation_id", consultationIds),
        ]);
        oduData = oduRes.data || [];
        outcomeData = outcomeRes.data || [];
        eboData = eboRes.data || [];
      }

      const enrichedConsultations = (consultations || []).map((c: any) => {
        const odu = oduData.find((o: any) => o.consultation_id === c.id);
        const outcome = outcomeData.find((o: any) => o.consultation_id === c.id);
        const ebo = eboData.find((e: any) => e.consultation_id === c.id);
        return {
          ...c,
          odu_name: odu?.odu_name || null,
          outcome_type: outcome?.outcome_type || null,
          outcome_subtype: outcome?.subtype || null,
          ebo_category: ebo?.category || null,
          ebo_status: ebo?.status || null,
        };
      });

      return new Response(JSON.stringify({ consultations: enrichedConsultations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /awo/clients/{id}/notes
    if (action === "get-notes" && req.method === "GET") {
      const clientId = url.searchParams.get("client_id");
      if (!clientId) {
        return new Response(JSON.stringify({ error: "client_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: notes, error } = await supabase
        .from("app_340b9f1944_client_notes")
        .select("*")
        .eq("client_id", clientId)
        .eq("awo_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ notes: notes || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /awo/clients/{id}/notes - save note
    if (action === "save-note" && req.method === "POST") {
      const body = await req.json();
      const { client_id, content, formatted_content } = body;

      if (!client_id || !content) {
        return new Response(JSON.stringify({ error: "client_id and content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: note, error } = await supabase
        .from("app_340b9f1944_client_notes")
        .insert({
          client_id,
          awo_id: user.id,
          content,
          formatted_content: formatted_content || content,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ note }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /awo/clients/{id}/notes - update note
    if (action === "update-note" && req.method === "PUT") {
      const body = await req.json();
      const { note_id, content, formatted_content } = body;

      if (!note_id || !content) {
        return new Response(JSON.stringify({ error: "note_id and content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: note, error } = await supabase
        .from("app_340b9f1944_client_notes")
        .update({
          content,
          formatted_content: formatted_content || content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note_id)
        .eq("awo_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ note }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - start consultation for client
    if (action === "start-consultation" && req.method === "POST") {
      const body = await req.json();
      const { client_id } = body;

      if (!client_id) {
        return new Response(JSON.stringify({ error: "client_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify client belongs to Awo
      const { data: client } = await supabase
        .from("app_340b9f1944_clients")
        .select("id, name")
        .eq("id", client_id)
        .eq("awo_id", user.id)
        .single();

      if (!client) {
        return new Response(JSON.stringify({ error: "Client not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create consultation
      const { data: consultation, error } = await supabase
        .from("app_340b9f1944_consultations")
        .insert({
          awo_id: user.id,
          client_id: client_id,
          client_name: client.name,
          status: "active",
          scheduled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ consultation }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});