import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ============ TIMEZONE UTILITIES ============
function getTimezoneOffset(timezone: string, date: Date): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 0;
  }
}

function convertTimestamp(isoString: string, fromTz: string, toTz: string): string {
  if (!isoString || fromTz === toTz) return isoString;
  try {
    const date = new Date(isoString);
    const fromOffset = getTimezoneOffset(fromTz, date);
    const toOffset = getTimezoneOffset(toTz, date);
    const diff = toOffset - fromOffset;
    const converted = new Date(date.getTime() + diff * 60000);
    return converted.toISOString();
  } catch {
    return isoString;
  }
}

function convertTimeString(timeStr: string, date: string, fromTz: string, toTz: string): string {
  if (!timeStr || fromTz === toTz) return timeStr;
  try {
    const fullDate = new Date(`${date}T${timeStr}:00`);
    const fromOffset = getTimezoneOffset(fromTz, fullDate);
    const toOffset = getTimezoneOffset(toTz, fullDate);
    const diff = toOffset - fromOffset;
    const converted = new Date(fullDate.getTime() + diff * 60000);
    const hours = String(converted.getHours()).padStart(2, '0');
    const mins = String(converted.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  } catch {
    return timeStr;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Helper to get user timezone from profile
    async function getUserTimezone(uid: string): Promise<string> {
      const { data } = await supabase
        .from("app_340b9f1944_profiles")
        .select("timezone")
        .eq("id", uid)
        .single();
      return data?.timezone || "America/New_York";
    }

    // GET actions
    if (req.method === "GET") {
      switch (action) {
        case "get-availability": {
          const awoId = url.searchParams.get("awo_id") || userId;
          if (!awoId) return jsonError("awo_id required", 400);

          const { data: blocks } = await supabase
            .from("app_340b9f1944_availability_blocks")
            .select("*")
            .eq("awo_id", awoId)
            .eq("is_active", true)
            .order("day_of_week");

          const { data: exceptions } = await supabase
            .from("app_340b9f1944_availability_exceptions")
            .select("*")
            .eq("awo_id", awoId)
            .gte("exception_date", new Date().toISOString().split("T")[0]);

          const awoTimezone = await getUserTimezone(awoId);

          return jsonResponse({ 
            blocks: blocks || [], 
            exceptions: exceptions || [],
            awo_timezone: awoTimezone
          });
        }

        case "get-booking-requests": {
          if (!userId) return jsonError("Unauthorized", 401);

          const status = url.searchParams.get("status");
          let query = supabase
            .from("app_340b9f1944_booking_requests")
            .select("*")
            .eq("awo_id", userId)
            .order("created_at", { ascending: false });

          if (status && status !== "all") {
            query = query.eq("status", status);
          }

          const { data, error } = await query;
          if (error) return jsonError(error.message, 500);

          // Enrich with client names
          const clientIds = [...new Set((data || []).map((r: Record<string, string>) => r.client_id))];
          const { data: profiles } = await supabase
            .from("app_340b9f1944_profiles")
            .select("id, full_name, email, timezone")
            .in("id", clientIds);

          const profileMap = new Map((profiles || []).map((p: Record<string, string>) => [p.id, p]));
          const awoTimezone = await getUserTimezone(userId);

          const enriched = (data || []).map((r: Record<string, string>) => {
            const clientProfile = profileMap.get(r.client_id) as Record<string, string> | undefined;
            const clientTz = r.client_timezone || clientProfile?.timezone || "America/New_York";
            return {
              ...r,
              client_name: clientProfile?.full_name || "Unknown Client",
              client_email: clientProfile?.email || "",
              client_timezone: clientTz,
              // Convert requested_at from client tz to awo tz for display
              requested_at_awo: convertTimestamp(r.requested_at, clientTz, awoTimezone),
              awo_timezone: awoTimezone,
            };
          });

          return jsonResponse({ requests: enriched, awo_timezone: awoTimezone });
        }

        case "get-available-slots": {
          const awoId = url.searchParams.get("awo_id");
          const date = url.searchParams.get("date");
          const clientTimezone = url.searchParams.get("client_timezone") || "America/New_York";
          if (!awoId || !date) return jsonError("awo_id and date required", 400);

          const awoTimezone = await getUserTimezone(awoId);

          // Convert client date to awo date context
          const targetDate = new Date(date + "T12:00:00Z");
          const dayOfWeek = targetDate.getDay();

          // Get blocks for this day
          const { data: blocks } = await supabase
            .from("app_340b9f1944_availability_blocks")
            .select("*")
            .eq("awo_id", awoId)
            .eq("day_of_week", dayOfWeek)
            .eq("is_active", true)
            .eq("is_break", false);

          // Check for exceptions
          const { data: exceptions } = await supabase
            .from("app_340b9f1944_availability_exceptions")
            .select("*")
            .eq("awo_id", awoId)
            .eq("exception_date", date);

          const isDayOff = exceptions?.some((e: Record<string, string>) => e.exception_type === "day_off");
          if (isDayOff || !blocks || blocks.length === 0) {
            return jsonResponse({ slots: [], awo_timezone: awoTimezone, client_timezone: clientTimezone });
          }

          // Get existing bookings/consultations for this date
          const dayStart = date + "T00:00:00Z";
          const dayEnd = date + "T23:59:59Z";
          
          const { data: existingBookings } = await supabase
            .from("app_340b9f1944_booking_requests")
            .select("requested_at, duration_minutes")
            .eq("awo_id", awoId)
            .in("status", ["pending", "accepted"])
            .gte("requested_at", dayStart)
            .lte("requested_at", dayEnd);

          const { data: existingConsultations } = await supabase
            .from("app_340b9f1944_consultations")
            .select("scheduled_at, duration_minutes")
            .eq("awo_id", awoId)
            .in("status", ["scheduled", "confirmed", "in_progress"])
            .gte("scheduled_at", dayStart)
            .lte("scheduled_at", dayEnd);

          // Generate 30-min slots from blocks
          const slots: { start: string; end: string; start_client: string; end_client: string }[] = [];
          for (const block of blocks) {
            const [startH, startM] = block.start_time.split(":").map(Number);
            const [endH, endM] = block.end_time.split(":").map(Number);
            let current = startH * 60 + startM;
            const endMin = endH * 60 + endM;

            while (current + 30 <= endMin) {
              const slotStart = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
              const slotEnd = `${String(Math.floor((current + 30) / 60)).padStart(2, "0")}:${String((current + 30) % 60).padStart(2, "0")}`;
              const slotStartISO = `${date}T${slotStart}:00`;
              const slotEndISO = `${date}T${slotEnd}:00`;

              // Check conflicts
              const hasConflict = [...(existingBookings || []), ...(existingConsultations || [])].some((b: Record<string, unknown>) => {
                const bStart = new Date(b.requested_at as string || b.scheduled_at as string).getTime();
                const bEnd = bStart + ((b.duration_minutes as number) || 60) * 60000;
                const sStart = new Date(slotStartISO).getTime();
                const sEnd = new Date(slotEndISO).getTime();
                return sStart < bEnd && sEnd > bStart;
              });

              if (!hasConflict) {
                // Convert slot times from Awo timezone to client timezone
                const startClient = convertTimeString(slotStart, date, awoTimezone, clientTimezone);
                const endClient = convertTimeString(slotEnd, date, awoTimezone, clientTimezone);
                slots.push({ 
                  start: slotStart, 
                  end: slotEnd,
                  start_client: startClient,
                  end_client: endClient
                });
              }
              current += 30;
            }
          }

          return jsonResponse({ 
            slots, 
            awo_timezone: awoTimezone, 
            client_timezone: clientTimezone 
          });
        }

        case "get-calendar": {
          if (!userId) return jsonError("Unauthorized", 401);
          const start = url.searchParams.get("start");
          const end = url.searchParams.get("end");

          const { data: consultations } = await supabase
            .from("app_340b9f1944_consultations")
            .select("*")
            .eq("awo_id", userId)
            .gte("scheduled_at", start || new Date().toISOString())
            .lte("scheduled_at", end || new Date(Date.now() + 90 * 86400000).toISOString())
            .order("scheduled_at");

          const { data: bookings } = await supabase
            .from("app_340b9f1944_bookings")
            .select("id, scheduled_at, duration_minutes, status, service_type")
            .eq("practitioner_id", userId)
            .gte("scheduled_at", start || new Date().toISOString())
            .lte("scheduled_at", end || new Date(Date.now() + 90 * 86400000).toISOString());

          const awoTimezone = await getUserTimezone(userId);

          return jsonResponse({ 
            consultations: consultations || [], 
            bookings: bookings || [],
            awo_timezone: awoTimezone
          });
        }

        case "get-timezone": {
          if (!userId) return jsonError("Unauthorized", 401);
          const timezone = await getUserTimezone(userId);
          return jsonResponse({ timezone });
        }

        default:
          return jsonError(`Unknown GET action: ${action}`, 400);
      }
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();

      switch (action) {
        case "save-availability": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { blocks } = body;
          const awoTimezone = await getUserTimezone(userId);

          // Deactivate existing blocks
          await supabase
            .from("app_340b9f1944_availability_blocks")
            .update({ is_active: false })
            .eq("awo_id", userId);

          // Insert new blocks with timezone
          if (blocks && blocks.length > 0) {
            const newBlocks = blocks.map((b: Record<string, unknown>) => ({
              awo_id: userId,
              day_of_week: b.day_of_week,
              start_time: b.start_time,
              end_time: b.end_time,
              is_break: b.is_break || false,
              is_active: true,
              timezone: awoTimezone,
            }));

            const { error } = await supabase
              .from("app_340b9f1944_availability_blocks")
              .insert(newBlocks);
            if (error) return jsonError(error.message, 500);
          }

          return jsonResponse({ success: true });
        }

        case "save-exception": {
          if (!userId) return jsonError("Unauthorized", 401);
          const awoTimezone = await getUserTimezone(userId);

          const { error } = await supabase
            .from("app_340b9f1944_availability_exceptions")
            .insert({
              awo_id: userId,
              exception_date: body.exception_date,
              exception_type: body.exception_type,
              start_time: body.start_time || null,
              end_time: body.end_time || null,
              reason: body.reason || null,
              timezone: awoTimezone,
            });
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true });
        }

        case "delete-exception": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { error } = await supabase
            .from("app_340b9f1944_availability_exceptions")
            .delete()
            .eq("id", body.exception_id)
            .eq("awo_id", userId);
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true });
        }

        case "create-booking-request": {
          if (!userId) return jsonError("Unauthorized", 401);
          const clientTimezone = body.client_timezone || await getUserTimezone(userId);
          const awoTimezone = await getUserTimezone(body.awo_id);

          // Convert client's requested time to UTC for storage
          const requestedAtUTC = body.requested_at;

          const { error } = await supabase
            .from("app_340b9f1944_booking_requests")
            .insert({
              client_id: userId,
              awo_id: body.awo_id,
              requested_at: requestedAtUTC,
              duration_minutes: body.duration_minutes || 60,
              service_type: body.service_type || "consultation",
              status: "pending",
              client_message: body.message || null,
              client_timezone: clientTimezone,
            });
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true, awo_timezone: awoTimezone });
        }

        case "accept-booking": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { request_id } = body;

          // Get the request
          const { data: request } = await supabase
            .from("app_340b9f1944_booking_requests")
            .select("*")
            .eq("id", request_id)
            .eq("awo_id", userId)
            .single();

          if (!request) return jsonError("Request not found", 404);

          // Update status
          await supabase
            .from("app_340b9f1944_booking_requests")
            .update({ status: "accepted", awo_response: "Booking accepted" })
            .eq("id", request_id);

          // Create consultation
          const { error } = await supabase
            .from("app_340b9f1944_consultations")
            .insert({
              awo_id: userId,
              client_id: request.client_id,
              client_name: request.client_name || "Client",
              consultation_type: request.service_type || "consultation",
              scheduled_at: request.requested_at,
              duration_minutes: request.duration_minutes || 60,
              status: "scheduled",
              booking_request_id: request_id,
            });
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true });
        }

        case "decline-booking": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { error } = await supabase
            .from("app_340b9f1944_booking_requests")
            .update({ status: "declined", awo_response: body.reason || "Declined" })
            .eq("id", body.request_id)
            .eq("awo_id", userId);
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true });
        }

        case "propose-new-time": {
          if (!userId) return jsonError("Unauthorized", 401);
          const awoTimezone = await getUserTimezone(userId);

          // Get the booking request to find client timezone
          const { data: request } = await supabase
            .from("app_340b9f1944_booking_requests")
            .select("client_id, client_timezone")
            .eq("id", body.request_id)
            .eq("awo_id", userId)
            .single();

          const clientTz = request?.client_timezone || "America/New_York";

          // proposed_time comes in Awo's timezone, convert to UTC for storage
          // but also store the client-facing version
          const proposedTimeClientTz = convertTimestamp(body.proposed_time, awoTimezone, clientTz);

          const { error } = await supabase
            .from("app_340b9f1944_booking_requests")
            .update({ 
              status: "proposed_new_time", 
              proposed_time: body.proposed_time,
              awo_response: body.message || `New time proposed (${clientTz}: ${proposedTimeClientTz})`,
            })
            .eq("id", body.request_id)
            .eq("awo_id", userId);
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true, proposed_time_client: proposedTimeClientTz });
        }

        case "update-timezone": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { timezone } = body;
          if (!timezone) return jsonError("timezone required", 400);

          const { error } = await supabase
            .from("app_340b9f1944_profiles")
            .update({ timezone })
            .eq("id", userId);
          if (error) return jsonError(error.message, 500);
          return jsonResponse({ success: true, timezone });
        }

        case "reschedule-event": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { event_id, event_type, new_start, new_end } = body;

          if (event_type === "consultation") {
            const { error } = await supabase
              .from("app_340b9f1944_consultations")
              .update({ 
                scheduled_at: new_start,
                updated_at: new Date().toISOString()
              })
              .eq("id", event_id)
              .eq("awo_id", userId);
            if (error) return jsonError(error.message, 500);
          } else if (event_type === "booking") {
            const { error } = await supabase
              .from("app_340b9f1944_bookings")
              .update({ 
                scheduled_at: new_start,
                updated_at: new Date().toISOString()
              })
              .eq("id", event_id)
              .eq("practitioner_id", userId);
            if (error) return jsonError(error.message, 500);
          }

          return jsonResponse({ success: true });
        }

        case "update-availability-block": {
          if (!userId) return jsonError("Unauthorized", 401);
          const { block_id, day_of_week, start_time, end_time } = body;

          if (block_id) {
            const { error } = await supabase
              .from("app_340b9f1944_availability_blocks")
              .update({ day_of_week, start_time, end_time, updated_at: new Date().toISOString() })
              .eq("id", block_id)
              .eq("awo_id", userId);
            if (error) return jsonError(error.message, 500);
          }

          return jsonResponse({ success: true });
        }

        default:
          return jsonError(`Unknown POST action: ${action}`, 400);
      }
    }

    return jsonError("Method not allowed", 405);
  } catch (err) {
    return jsonError(err.message || "Internal error", 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}