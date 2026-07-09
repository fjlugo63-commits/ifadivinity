import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_ACCOUNTS = [
  {
    email: "awo_test@ifadivinity.com",
    role: "awo",
    full_name: "Awo Test",
    needs_house: true,
    is_test: true,
  },
  {
    email: "client_test@ifadivinity.com",
    role: "client",
    full_name: "Client Test",
    needs_house: false,
    is_test: true,
  },
  {
    email: "admin_test@ifadivinity.com",
    role: "admin",
    full_name: "Admin Test",
    needs_house: false,
    is_test: true,
  },
  {
    email: "house_admin_test@ifadivinity.com",
    role: "house_admin",
    full_name: "House Admin Test",
    needs_house: true,
    is_test: true,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: missing environment variables" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const testSecret = Deno.env.get("TEST_ACCOUNTS_SECRET") || "ifa-test-accounts-2026";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Handle GET - list test accounts
    if (req.method === "GET") {
      const { data: profiles, error } = await supabase
        .from("app_340b9f1944_profiles")
        .select("id, email, full_name, role, is_test, created_at")
        .eq("is_test", true)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: `Failed to fetch test accounts: ${error.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, accounts: profiles || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle POST - create test accounts or send magic link
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { secret, action } = body;

    if (!secret || secret !== testSecret) {
      return new Response(JSON.stringify({ error: "Invalid test accounts secret key. Default is: ifa-test-accounts-2026" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: send-magic-link
    if (action === "send-magic-link") {
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required for magic link" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: otpError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (otpError) {
        return new Response(JSON.stringify({ error: `Magic link failed: ${otpError.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: `Magic link sent to ${email}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create (default)
    const results = [];
    const defaultPassword = "TestAccount2026!";

    for (const account of TEST_ACCOUNTS) {
      try {
        // Step 1: Create auth user
        let userId = null;
        let isExisting = false;

        const createResult = await supabase.auth.admin.createUser({
          email: account.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: { full_name: account.full_name, role: account.role },
        });

        if (createResult.error) {
          // Extract error message - handle various error shapes
          let errMsg = "";
          const rawErr = createResult.error;
          if (typeof rawErr === "string") {
            errMsg = rawErr;
          } else if (rawErr.message && typeof rawErr.message === "string") {
            errMsg = rawErr.message;
          } else if (rawErr.msg && typeof rawErr.msg === "string") {
            errMsg = rawErr.msg;
          } else {
            errMsg = JSON.stringify(rawErr);
          }

          const errLower = errMsg.toLowerCase();
          const isExistsError = errLower.includes("already") || errLower.includes("exists") || errLower.includes("registered") || errLower.includes("duplicate") || errLower.includes("unique");

          if (isExistsError) {
            // User exists, find them
            const listResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (!listResult.error && listResult.data?.users) {
              const existingUser = listResult.data.users.find((u) => u.email === account.email);
              if (existingUser) {
                userId = existingUser.id;
                isExisting = true;
                await supabase.auth.admin.updateUserById(userId, { password: defaultPassword, email_confirm: true });
              }
            }

            if (!userId) {
              const { data: profileData } = await supabase
                .from("app_340b9f1944_profiles")
                .select("id")
                .eq("email", account.email)
                .maybeSingle();
              if (profileData) {
                userId = profileData.id;
                isExisting = true;
              }
            }

            if (!userId) {
              results.push({ email: account.email, role: account.role, status: "error", error: `User exists but could not be found: ${errMsg}` });
              continue;
            }
          } else {
            // SDK createUser failed with non-exists error - try direct REST API
            try {
              const restResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                  "apikey": supabaseServiceKey,
                },
                body: JSON.stringify({
                  email: account.email,
                  password: defaultPassword,
                  email_confirm: true,
                  user_metadata: { full_name: account.full_name, role: account.role },
                }),
              });

              if (restResponse.ok) {
                const restData = await restResponse.json();
                userId = restData.id;
              } else {
                const restText = await restResponse.text();
                // Check if it's an "already exists" error from REST
                const restLower = restText.toLowerCase();
                if (restLower.includes("already") || restLower.includes("exists") || restLower.includes("duplicate") || restLower.includes("unique")) {
                  // User exists - find them
                  const listResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
                  if (!listResult.error && listResult.data?.users) {
                    const existingUser = listResult.data.users.find((u) => u.email === account.email);
                    if (existingUser) {
                      userId = existingUser.id;
                      isExisting = true;
                      await supabase.auth.admin.updateUserById(userId, { password: defaultPassword, email_confirm: true });
                    }
                  }
                }

                if (!userId) {
                  results.push({ email: account.email, role: account.role, status: "error", error: `Auth creation failed (REST ${restResponse.status}): ${restText}` });
                  continue;
                }
              }
            } catch (fetchErr) {
              results.push({ email: account.email, role: account.role, status: "error", error: `Auth creation failed. SDK error: ${errMsg}. Fetch error: ${fetchErr.message}` });
              continue;
            }
          }
        } else {
          userId = createResult.data.user.id;
        }

        if (!userId) {
          results.push({ email: account.email, role: account.role, status: "error", error: "Could not determine user ID" });
          continue;
        }

        // Step 2: Upsert profile
        const profileData = {
          id: userId,
          email: account.email,
          full_name: account.full_name,
          role: account.role,
          is_test: true,
          updated_at: new Date().toISOString(),
        };

        // Set verified_egbo for awo accounts
        if (account.role === "awo") {
          profileData.verified_egbo = true;
        }

        const { error: profileError } = await supabase
          .from("app_340b9f1944_profiles")
          .upsert(profileData, { onConflict: "id" });

        if (profileError) {
          results.push({ email: account.email, role: account.role, status: "error", error: `Profile upsert failed: ${profileError.message}` });
          continue;
        }

        // Step 3: Create role-specific records
        if (account.role === "awo" || account.role === "house_admin") {
          // Get or create a test house
          let houseId = null;

          const { data: houseData } = await supabase
            .from("app_340b9f1944_ifa_houses")
            .select("id")
            .limit(1)
            .maybeSingle();

          houseId = houseData?.id || null;

          if (!houseId) {
            const { data: newHouse, error: houseError } = await supabase
              .from("app_340b9f1944_ifa_houses")
              .insert({
                name: "Test House of Ifa",
                description: "Default test house for development",
                owner_id: userId,
                subscription_tier: "basic",
              })
              .select("id")
              .single();

            if (houseError) {
              console.warn(`House creation failed: ${houseError.message}`);
            } else {
              houseId = newHouse?.id || null;
            }
          }

          if (houseId) {
            const { data: existingPrac } = await supabase
              .from("app_340b9f1944_house_practitioners")
              .select("id")
              .eq("house_id", houseId)
              .eq("practitioner_id", userId)
              .maybeSingle();

            if (existingPrac) {
              await supabase
                .from("app_340b9f1944_house_practitioners")
                .update({
                  role: account.role === "house_admin" ? "house_admin" : "awo",
                  is_active: true,
                })
                .eq("id", existingPrac.id);
            } else {
              const { error: pracError } = await supabase
                .from("app_340b9f1944_house_practitioners")
                .insert({
                  house_id: houseId,
                  practitioner_id: userId,
                  role: account.role === "house_admin" ? "house_admin" : "awo",
                  is_active: true,
                  joined_at: new Date().toISOString(),
                });

              if (pracError) {
                console.warn(`House practitioner insert failed: ${pracError.message}`);
              }
            }
          }
        }

        if (account.role === "client") {
          let awoId = null;

          const { data: awoProfile } = await supabase
            .from("app_340b9f1944_profiles")
            .select("id")
            .eq("role", "awo")
            .limit(1)
            .maybeSingle();

          awoId = awoProfile?.id || null;

          if (!awoId) {
            results.push({
              email: account.email,
              role: account.role,
              status: isExisting ? "updated" : "created",
              userId,
              note: "Profile created but client record skipped (no awo found). Re-run after awo account exists.",
            });
            continue;
          }

          const { data: existingClient } = await supabase
            .from("app_340b9f1944_clients")
            .select("id")
            .eq("email", account.email)
            .maybeSingle();

          if (existingClient) {
            await supabase
              .from("app_340b9f1944_clients")
              .update({
                user_id: userId,
                name: account.full_name,
                status: "active",
                is_test: true,
                awo_id: awoId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingClient.id);
          } else {
            const { error: clientError } = await supabase
              .from("app_340b9f1944_clients")
              .insert({
                user_id: userId,
                awo_id: awoId,
                name: account.full_name,
                email: account.email,
                timezone: "America/New_York",
                status: "active",
                is_test: true,
              });

            if (clientError) {
              console.warn(`Client record insert failed: ${clientError.message}`);
            }
          }
        }

        results.push({
          email: account.email,
          role: account.role,
          status: isExisting ? "updated" : "created",
          userId,
        });
      } catch (err) {
        results.push({ email: account.email, role: account.role, status: "error", error: err.message || String(err) });
      }
    }

    // Audit log (non-critical)
    try {
      await supabase.from("app_340b9f1944_audit_logs").insert({
        action: "test_accounts.seeded",
        resource: "system",
        metadata: { results, created_at: new Date().toISOString() },
      });
    } catch {
      // Non-critical
    }

    const successCount = results.filter((r) => r.status === "created" || r.status === "updated").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return new Response(JSON.stringify({
      success: errorCount === 0,
      message: `Test accounts setup complete: ${successCount} succeeded, ${errorCount} failed`,
      results,
      defaultPassword,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Server error: ${error?.message || "Unknown"}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});