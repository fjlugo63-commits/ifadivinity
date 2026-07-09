import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a client with the user's token to verify they're admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("app_340b9f1944_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Route to handler
    switch (path) {
      case "create-test-account": {
        const { email, password, full_name, role } = body;

        if (!email || !password || !role) {
          return new Response(JSON.stringify({ error: "email, password, and role are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!["client", "awo", "buyer", "seller", "admin"].includes(role)) {
          return new Response(JSON.stringify({ error: "Invalid role. Must be: client, awo, buyer, seller, or admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create user via Admin API
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || email.split("@")[0], role },
        });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create profile record
        const { error: profileError } = await adminClient
          .from("app_340b9f1944_profiles")
          .upsert({
            id: newUser.user.id,
            email,
            full_name: full_name || email.split("@")[0],
            role,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        // If role is client, also create a client record
        if (role === "client") {
          const { error: clientError } = await adminClient
            .from("app_340b9f1944_clients")
            .insert({
              name: full_name || email.split("@")[0],
              email,
              timezone: "America/New_York",
              status: "active",
              awo_id: user.id, // Assign to the admin creating them (or a placeholder)
            });

          if (clientError && !clientError.message.includes("duplicate")) {
            console.error("Client record creation error:", clientError);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          email,
          role,
          message: `Test ${role} account created successfully`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify-seller": {
        const { seller_id, verified } = body;
        if (!seller_id) {
          return new Response(JSON.stringify({ error: "seller_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await adminClient
          .from("app_340b9f1944_profiles")
          .update({ verified_egbo: verified })
          .eq("id", seller_id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log audit
        await adminClient.from("app_340b9f1944_audit_logs").insert({
          actor_id: user.id,
          action: verified ? "seller.verified" : "seller.verification_revoked",
          resource: "profiles",
          resource_id: seller_id,
          metadata: { verified },
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "refund-order": {
        const { order_id } = body;
        if (!order_id) {
          return new Response(JSON.stringify({ error: "order_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get the order
        const { data: order, error: orderError } = await adminClient
          .from("app_340b9f1944_orders")
          .select("*")
          .eq("id", order_id)
          .single();

        if (orderError || !order) {
          return new Response(JSON.stringify({ error: "Order not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update order status to refunded
        const { error: refundError } = await adminClient
          .from("app_340b9f1944_orders")
          .update({ status: "refunded" })
          .eq("id", order_id);

        if (refundError) {
          return new Response(JSON.stringify({ error: refundError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log audit
        await adminClient.from("app_340b9f1944_audit_logs").insert({
          actor_id: user.id,
          action: "order.refunded",
          resource: "orders",
          resource_id: order_id,
          metadata: { amount: order.total_amount },
        });

        return new Response(JSON.stringify({ success: true, refunded: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown endpoint: ${path}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});