import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // GET actions
    if (req.method === "GET") {
      // Get conversation thread with a specific user
      if (action === "thread") {
        const partnerId = url.searchParams.get("partner_id");
        if (!partnerId) {
          return new Response(JSON.stringify({ error: "partner_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("app_340b9f1944_messages")
          .select("*")
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
          .order("created_at", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ messages: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get list of conversations (unique partners)
      if (action === "conversations") {
        const { data: sentMessages, error: sentError } = await supabase
          .from("app_340b9f1944_messages")
          .select("*")
          .eq("sender_id", user.id)
          .order("created_at", { ascending: false });

        const { data: receivedMessages, error: recError } = await supabase
          .from("app_340b9f1944_messages")
          .select("*")
          .eq("receiver_id", user.id)
          .order("created_at", { ascending: false });

        if (sentError || recError) {
          return new Response(JSON.stringify({ error: "Failed to fetch conversations" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const allMessages = [...(sentMessages || []), ...(receivedMessages || [])];
        
        // Group by partner and get latest message per conversation
        const conversationMap = new Map<string, any>();
        for (const msg of allMessages) {
          const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          const existing = conversationMap.get(partnerId);
          if (!existing || new Date(msg.created_at) > new Date(existing.last_message.created_at)) {
            conversationMap.set(partnerId, {
              partner_id: partnerId,
              last_message: msg,
            });
          }
        }

        // Get partner profiles
        const partnerIds = Array.from(conversationMap.keys());
        let partners: any[] = [];
        if (partnerIds.length > 0) {
          const { data: profileData } = await supabase
            .from("app_340b9f1944_profiles")
            .select("id, full_name, avatar_url, role")
            .in("id", partnerIds);
          partners = profileData || [];
        }

        const conversations = Array.from(conversationMap.values()).map((conv) => {
          const partner = partners.find((p) => p.id === conv.partner_id);
          return {
            ...conv,
            partner_name: partner?.full_name || "Unknown",
            partner_avatar: partner?.avatar_url || null,
            partner_role: partner?.role || "unknown",
          };
        });

        // Sort by latest message
        conversations.sort((a, b) => 
          new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
        );

        return new Response(JSON.stringify({ conversations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get unread count
      if (action === "unread-count") {
        const { count, error } = await supabase
          .from("app_340b9f1944_messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .is("read_at", null);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ unread_count: count || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();

      // Send a message
      if (action === "send") {
        const { receiver_id, message_text, consultation_id } = body;
        
        if (!receiver_id || !message_text?.trim()) {
          return new Response(JSON.stringify({ error: "receiver_id and message_text required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("app_340b9f1944_messages")
          .insert({
            sender_id: user.id,
            receiver_id,
            message_text: message_text.trim(),
            consultation_id: consultation_id || null,
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark messages as read
      if (action === "mark-read") {
        const { partner_id } = body;
        
        if (!partner_id) {
          return new Response(JSON.stringify({ error: "partner_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("app_340b9f1944_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("sender_id", partner_id)
          .eq("receiver_id", user.id)
          .is("read_at", null);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
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
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});