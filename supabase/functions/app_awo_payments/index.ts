import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST PAYMENTS (transaction history)
    if (action === "list-payments" && req.method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const type = url.searchParams.get("type"); // consultation, ebo, or null for all
      const status = url.searchParams.get("status"); // paid, pending, unpaid, refunded
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from("app_340b9f1944_payments")
        .select("*", { count: "exact" })
        .eq("awo_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) query = query.eq("payment_type", type);
      if (status) query = query.eq("payment_status", status);

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ payments: data, total: count, page, limit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET PAYMENT SUMMARY (overview cards)
    if (action === "payment-summary" && req.method === "GET") {
      const { data: payments, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .select("amount, payment_status, payment_type")
        .eq("awo_id", user.id);

      if (error) throw error;

      const summary = {
        total_revenue: 0,
        pending_amount: 0,
        consultation_revenue: 0,
        ebo_revenue: 0,
        total_transactions: payments?.length || 0,
        paid_count: 0,
        pending_count: 0,
        unpaid_count: 0,
        refunded_count: 0,
      };

      (payments || []).forEach((p) => {
        const amt = parseFloat(p.amount) || 0;
        if (p.payment_status === "paid") {
          summary.total_revenue += amt;
          summary.paid_count++;
          if (p.payment_type === "consultation") summary.consultation_revenue += amt;
          if (p.payment_type === "ebo") summary.ebo_revenue += amt;
        } else if (p.payment_status === "pending") {
          summary.pending_amount += amt;
          summary.pending_count++;
        } else if (p.payment_status === "unpaid") {
          summary.unpaid_count++;
        } else if (p.payment_status === "refunded") {
          summary.refunded_count++;
        }
      });

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET PENDING PAYMENTS
    if (action === "pending-payments" && req.method === "GET") {
      const { data, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .select("*")
        .eq("awo_id", user.id)
        .in("payment_status", ["unpaid", "pending"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ payments: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // CREATE CONSULTATION PAYMENT
    if (action === "create-consultation-payment" && req.method === "POST") {
      const body = await req.json();
      const { consultation_id, client_id, amount, currency, client_name, client_email } = body;

      if (!consultation_id || !amount) {
        return new Response(JSON.stringify({ error: "consultation_id and amount required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .insert({
          awo_id: user.id,
          client_id: client_id || null,
          consultation_id,
          payment_type: "consultation",
          amount: parseFloat(amount),
          currency: currency || "USD",
          payment_status: "unpaid",
          notes: client_name ? `Payment for consultation with ${client_name}` : null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // CREATE EBO PAYMENT
    if (action === "create-ebo-payment" && req.method === "POST") {
      const body = await req.json();
      const { ebo_id, client_id, consultation_id, amount, currency, botanica_items, client_name } = body;

      if (!ebo_id || !amount) {
        return new Response(JSON.stringify({ error: "ebo_id and amount required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .insert({
          awo_id: user.id,
          client_id: client_id || null,
          consultation_id: consultation_id || null,
          ebo_id,
          payment_type: "ebo",
          amount: parseFloat(amount),
          currency: currency || "USD",
          payment_status: "unpaid",
          botanica_items: botanica_items || [],
          notes: client_name ? `Ebo payment for ${client_name}` : null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GENERATE PAYMENT LINK (Stripe)
    if (action === "generate-payment-link" && req.method === "POST") {
      const body = await req.json();
      const { payment_id } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get the payment record
      const { data: payment, error: fetchErr } = await supabaseClient
        .from("app_340b9f1944_payments")
        .select("*")
        .eq("id", payment_id)
        .eq("awo_id", user.id)
        .single();

      if (fetchErr || !payment) {
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Create Stripe checkout session
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        // Simulate payment link if no Stripe key
        const mockLink = `https://checkout.stripe.com/pay/demo_${payment_id.slice(0, 8)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: updated, error: updateErr } = await supabaseClient
          .from("app_340b9f1944_payments")
          .update({
            stripe_payment_link_url: mockLink,
            payment_link_expires_at: expiresAt,
            payment_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment_id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        return new Response(JSON.stringify({ payment: updated, payment_link: mockLink }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Real Stripe integration
      const amountCents = Math.round(payment.amount * 100);
      const description = payment.payment_type === "consultation"
        ? "Consultation Payment"
        : "Ebo Prescription Payment";

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "mode": "payment",
          "line_items[0][price_data][currency]": payment.currency.toLowerCase(),
          "line_items[0][price_data][product_data][name]": description,
          "line_items[0][price_data][unit_amount]": amountCents.toString(),
          "line_items[0][quantity]": "1",
          "success_url": `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/awo/payments?success=true&payment_id=${payment_id}`,
          "cancel_url": `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/awo/payments?cancelled=true`,
          "metadata[payment_id]": payment_id,
          "metadata[payment_type]": payment.payment_type,
          "metadata[awo_id]": user.id,
          "expires_after_completion": "enabled",
        }),
      });

      const session = await stripeRes.json();

      if (session.error) {
        return new Response(JSON.stringify({ error: session.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: updated, error: updateErr } = await supabaseClient
        .from("app_340b9f1944_payments")
        .update({
          stripe_checkout_session_id: session.id,
          stripe_payment_link_url: session.url,
          payment_link_expires_at: expiresAt,
          payment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ payment: updated, payment_link: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MARK AS PAID (manual)
    if (action === "mark-paid" && req.method === "POST") {
      const body = await req.json();
      const { payment_id } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_id)
        .eq("awo_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // INITIATE REFUND
    if (action === "refund" && req.method === "POST") {
      const body = await req.json();
      const { payment_id, reason } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get payment
      const { data: payment, error: fetchErr } = await supabaseClient
        .from("app_340b9f1944_payments")
        .select("*")
        .eq("id", payment_id)
        .eq("awo_id", user.id)
        .single();

      if (fetchErr || !payment) {
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (payment.payment_status !== "paid") {
        return new Response(JSON.stringify({ error: "Can only refund paid payments" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // If Stripe payment intent exists, attempt Stripe refund
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey && payment.stripe_payment_intent_id) {
        const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "payment_intent": payment.stripe_payment_intent_id,
            "reason": "requested_by_customer",
          }),
        });

        const refund = await refundRes.json();
        if (refund.error) {
          return new Response(JSON.stringify({ error: refund.error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Update payment status
      const { data, error } = await supabaseClient
        .from("app_340b9f1944_payments")
        .update({
          payment_status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_reason: reason || "Requested by Awo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});