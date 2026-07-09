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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: missing environment variables" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const superAdminSecret = Deno.env.get("SUPER_ADMIN_SECRET") || "ifa-super-admin-2026";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, name, secret } = body;

    if (!secret || secret !== superAdminSecret) {
      return new Response(JSON.stringify({ error: "Invalid admin secret key. Default is: ifa-super-admin-2026" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Try to sign up the user using the regular signUp method first
    // This avoids issues with admin.createUser which may not be available
    let userId: string | null = null;
    let isExisting = false;

    // Try admin createUser first
    const createResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || "Super Admin", role: "admin" },
    });

    if (createResult.error) {
      const errMsg = createResult.error.message || JSON.stringify(createResult.error) || "";
      
      // If user already exists, try to find and update them
      if (errMsg.includes("already") || errMsg.includes("exists") || errMsg.includes("registered") || errMsg.includes("duplicate")) {
        // Try to find the user
        const listResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
        
        if (listResult.error) {
          // If listUsers also fails, try a different approach - check profiles table
          const { data: profileData } = await supabase
            .from("app_340b9f1944_profiles")
            .select("id, email")
            .eq("email", email)
            .maybeSingle();

          if (profileData) {
            userId = profileData.id;
            isExisting = true;
          } else {
            return new Response(JSON.stringify({ 
              error: `User may already exist but cannot be found. Try signing in first at /auth, then contact support. Details: ${errMsg}`
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const existingUser = listResult.data?.users?.find((u: any) => u.email === email);
          if (existingUser) {
            userId = existingUser.id;
            isExisting = true;
            // Update their password
            await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
          } else {
            return new Response(JSON.stringify({ 
              error: `Could not find existing user with email ${email}. Original error: ${errMsg}`
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } else {
        // Not a duplicate error - try alternative: use signUp via Auth API directly
        // Make a direct REST call to Supabase Auth
        try {
          const signUpResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "apikey": supabaseServiceKey,
            },
            body: JSON.stringify({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: name || "Super Admin", role: "admin" },
            }),
          });

          if (signUpResponse.ok) {
            const signUpData = await signUpResponse.json();
            userId = signUpData.id;
          } else {
            const signUpError = await signUpResponse.text();
            return new Response(JSON.stringify({ 
              error: `Failed to create user. SDK error: ${errMsg}. REST error: ${signUpError}`
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (fetchErr: any) {
          return new Response(JSON.stringify({ 
            error: `Failed to create user via both methods. SDK: ${errMsg}. Fetch: ${fetchErr.message}`
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      userId = createResult.data.user.id;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not determine user ID after creation attempts" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Handle profile
    const { data: existingProfile } = await supabase
      .from("app_340b9f1944_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateError } = await supabase
        .from("app_340b9f1944_profiles")
        .update({
          full_name: name || "Super Admin",
          role: "admin",
          verified_egbo: true,
          bio: "Platform Super Administrator",
        })
        .eq("id", userId);

      if (updateError) {
        return new Response(JSON.stringify({ error: `Profile update failed: ${updateError.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: insertError } = await supabase
        .from("app_340b9f1944_profiles")
        .insert({
          id: userId,
          email: email,
          full_name: name || "Super Admin",
          role: "admin",
          verified_egbo: true,
          bio: "Platform Super Administrator",
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: `Profile insert failed: ${insertError.message}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Step 3: Audit log (non-critical)
    try {
      await supabase.from("app_340b9f1944_audit_logs").insert({
        actor_id: userId,
        action: "super_admin.created",
        resource: "profiles",
        resource_id: userId,
        metadata: { email, elevated: isExisting },
      });
    } catch {
      // Non-critical
    }

    return new Response(JSON.stringify({
      success: true,
      message: isExisting
        ? `Existing user (${email}) elevated to Super Admin successfully!`
        : `Super Admin account created successfully for ${email}!`,
      userId,
      email,
      permissions: {
        role: "admin",
        verified_egbo: true,
        can_manage_users: true,
        can_manage_orders: true,
        can_verify_sellers: true,
        can_issue_refunds: true,
        can_create_products: true,
        can_create_egbo_services: true,
        can_view_audit_logs: true,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Server error: ${error?.message || JSON.stringify(error) || "Unknown"}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});