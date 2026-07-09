import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTransactionalEmail(to: string, subject: string, body: string, supabase: any) {
  console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
  await supabase.from("app_340b9f1944_audit_logs").insert({
    actor_id: null,
    action: "email.sent",
    resource: "notifications",
    resource_id: to,
    metadata: { subject, body_preview: body.slice(0, 200) },
  });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({ from: "Ifa Marketplace <noreply@ifamarketplace.com>", to: [to], subject, text: body }),
      });
    } catch (err) { console.error("[EMAIL] Resend error:", err); }
    return;
  }

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (sendgridKey) {
    try {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sendgridKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: "noreply@ifamarketplace.com", name: "Ifa Marketplace" },
          subject,
          content: [{ type: "text/plain", value: body }],
        }),
      });
    } catch (err) { console.error("[EMAIL] SendGrid error:", err); }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!stripeSecretKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { order_id, service_type, booking_id } = session.metadata || {};

      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: orderError } = await supabase
        .from("app_340b9f1944_orders")
        .update({ status: "paid", stripe_payment_intent_id: session.payment_intent as string })
        .eq("id", order_id);

      if (orderError) throw orderError;

      const { data: order } = await supabase
        .from("app_340b9f1944_orders")
        .select("*, buyer:buyer_id(id, email, full_name)")
        .eq("id", order_id)
        .single();

      const { data: orderItems } = await supabase
        .from("app_340b9f1944_order_items")
        .select("*, seller:seller_id(id, email, full_name)")
        .eq("order_id", order_id);

      if (service_type === "egbo") {
        if (booking_id) {
          await supabase
            .from("app_340b9f1944_bookings")
            .update({ status: "scheduled", meeting_url: `https://meet.jit.si/ifa-egbo-${order_id.slice(0, 8)}` })
            .eq("id", booking_id);
        } else if (orderItems && order) {
          const egboItem = orderItems[0];
          await supabase.from("app_340b9f1944_bookings").insert({
            client_id: order.buyer_id,
            practitioner_id: egboItem.seller_id,
            product_id: egboItem.product_id,
            service_type: "egbo",
            scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            duration_minutes: 90,
            price: egboItem.price,
            status: "scheduled",
            meeting_url: `https://meet.jit.si/ifa-egbo-${order_id.slice(0, 8)}`,
            notes: `Auto-created from order ${order_id}`,
          });
        }
      }

      if (orderItems) {
        for (const item of orderItems) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from("app_340b9f1944_products")
              .select("stock_quantity, is_digital, service_type")
              .eq("id", item.product_id)
              .single();
            if (product && !product.is_digital && product.service_type !== "egbo" && product.stock_quantity !== null) {
              await supabase
                .from("app_340b9f1944_products")
                .update({ stock_quantity: Math.max(0, product.stock_quantity - item.quantity) })
                .eq("id", item.product_id);
            }
          }
        }
      }

      const buyerEmail = order?.buyer?.email;
      const buyerName = order?.buyer?.full_name || "Customer";
      const totalFormatted = `$${(order?.total_amount || 0).toFixed(2)}`;

      if (buyerEmail) {
        const isEgbo = service_type === "egbo";
        const buyerSubject = isEgbo
          ? `Your Egbo Service Booking is Confirmed - Order #${order_id.slice(0, 8)}`
          : `Order Confirmed - #${order_id.slice(0, 8)}`;
        const buyerBody = isEgbo
          ? `Hello ${buyerName},\n\nYour Egbo service booking has been confirmed and payment of ${totalFormatted} received.\n\nSession details:\n- Meeting: https://meet.jit.si/ifa-egbo-${order_id.slice(0, 8)}\n- Duration: 90 minutes\n\nYour practitioner will confirm the exact time.\n\nAse,\nIfa Divinity Marketplace`
          : `Hello ${buyerName},\n\nOrder #${order_id.slice(0, 8)} confirmed! Payment of ${totalFormatted} received.\n\nTrack your order in your dashboard.\n\nAse,\nIfa Divinity Marketplace`;
        await sendTransactionalEmail(buyerEmail, buyerSubject, buyerBody, supabase);
      }

      if (orderItems) {
        const sellerEmails = new Set<string>();
        for (const item of orderItems) {
          const sellerEmail = item.seller?.email;
          if (sellerEmail && !sellerEmails.has(sellerEmail)) {
            sellerEmails.add(sellerEmail);
            const sellerName = item.seller?.full_name || "Seller";
            const isEgbo = service_type === "egbo";
            const sellerSubject = isEgbo
              ? `New Egbo Booking - Order #${order_id.slice(0, 8)}`
              : `New Order - #${order_id.slice(0, 8)}`;
            const sellerBody = isEgbo
              ? `Hello ${sellerName},\n\nNew Egbo booking!\nClient: ${buyerName}\nOrder: #${order_id.slice(0, 8)}\nAmount: ${totalFormatted}\nMeeting: https://meet.jit.si/ifa-egbo-${order_id.slice(0, 8)}\n\nPlease confirm session time.\n\nAse,\nIfa Divinity Marketplace`
              : `Hello ${sellerName},\n\nNew order!\nOrder: #${order_id.slice(0, 8)}\nItem: ${item.title}\nQty: ${item.quantity}\nAmount: $${item.price.toFixed(2)}\n\nPrepare for fulfillment.\n\nAse,\nIfa Divinity Marketplace`;
            await sendTransactionalEmail(sellerEmail, sellerSubject, sellerBody, supabase);
          }
        }
      }

      await supabase.from("app_340b9f1944_audit_logs").insert({
        actor_id: null,
        action: "order.completed",
        resource: "orders",
        resource_id: order_id,
        metadata: { service_type, booking_id, payment_intent: session.payment_intent, emails_sent: true },
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await supabase.from("app_340b9f1944_audit_logs").insert({
        actor_id: null,
        action: "order.payment_failed",
        resource: "payments",
        resource_id: paymentIntent.id,
        metadata: { error: paymentIntent.last_payment_error?.message },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});