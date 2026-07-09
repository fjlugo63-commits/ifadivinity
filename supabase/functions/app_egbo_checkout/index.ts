import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { items, booking_selection } = await req.json();

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    let serviceType: string | null = null;
    if (items.some((item: any) => item.service_type === "egbo")) {
      serviceType = "egbo";
    }

    const { data: order, error: orderError } = await supabase
      .from("app_340b9f1944_orders")
      .insert({
        buyer_id: user.id,
        status: "pending",
        total_amount: totalAmount,
        currency: "USD",
        notes: serviceType ? `Egbo service order` : null,
      })
      .select("id")
      .single();

    if (orderError) {
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      seller_id: item.seller_id,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("app_340b9f1944_order_items")
      .insert(orderItems);

    if (itemsError) {
      await supabase.from("app_340b9f1944_orders").delete().eq("id", order.id);
      throw new Error(`Order items creation failed: ${itemsError.message}`);
    }

    let bookingId: string | null = null;
    if (booking_selection && serviceType === "egbo") {
      const { data: booking, error: bookingError } = await supabase
        .from("app_340b9f1944_bookings")
        .insert({
          client_id: user.id,
          practitioner_id: booking_selection.practitioner_id,
          product_id: booking_selection.product_id,
          service_type: "egbo",
          scheduled_at: booking_selection.scheduled_at,
          duration_minutes: booking_selection.duration_minutes || 90,
          price: booking_selection.price,
          status: "pending_reservation",
          notes: `Order: ${order.id}`,
        })
        .select("id")
        .single();

      if (!bookingError && booking) {
        bookingId = booking.id;
      }
    }

    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.title,
          ...(item.service_type === "egbo" && {
            description: `Egbo Service - ${item.duration_minutes || 90} min session`,
          }),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin") || "http://localhost:5173"}/orders?success=true`,
      cancel_url: `${req.headers.get("origin") || "http://localhost:5173"}/cart?cancelled=true`,
      customer_email: user.email,
      metadata: {
        order_id: order.id,
        service_type: serviceType || "product",
        booking_id: bookingId || "",
        user_id: user.id,
      },
    });

    await supabase
      .from("app_340b9f1944_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    await supabase.from("app_340b9f1944_audit_logs").insert({
      actor_id: user.id,
      action: "order.created",
      resource: "orders",
      resource_id: order.id,
      metadata: {
        service_type: serviceType,
        item_count: items.length,
        booking_id: bookingId,
        stripe_session_id: session.id,
      },
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        orderId: order.id,
        bookingId: bookingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});