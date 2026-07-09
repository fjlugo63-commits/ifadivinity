import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

// Ebo categories with metadata
const EBO_CATEGORIES = [
  { key: 'ebo_riru', label: 'Ebo Riru', meaning: 'Appeasement', icon: 'hand-heart' },
  { key: 'ebo_ipese', label: 'Ebo Ìpẹ̀sè', meaning: 'Offering', icon: 'gift' },
  { key: 'ebo_ibori', label: 'Ebo Ìbòrí', meaning: 'Head Rogation', icon: 'crown' },
  { key: 'ebo_itegun', label: 'Ebo Ìtẹ̀gùn', meaning: 'Cleansing', icon: 'droplets' },
  { key: 'ebo_isun', label: 'Ebo Ìsún', meaning: 'Protection', icon: 'shield' },
  { key: 'ebo_iwefa', label: 'Ebo Ìwẹ̀fà', meaning: 'Purification', icon: 'sparkles' },
  { key: 'ebo_idana', label: 'Ebo Ìdáná', meaning: 'Fire Ritual', icon: 'flame' },
  { key: 'ebo_iranwo', label: 'Ebo Ìrànwọ́', meaning: 'Assistance', icon: 'helping-hand' },
  { key: 'ebo_isokan', label: 'Ebo Ìṣọ̀kan', meaning: 'Alignment', icon: 'compass' },
];

// Ebo items reference
const EBO_ITEMS = [
  { key: 'obi', label: 'Obi', meaning: 'Kola Nut' },
  { key: 'orogbo', label: 'Orogbo', meaning: 'Bitter Kola' },
  { key: 'oti', label: 'Oti', meaning: 'Gin/Spirits' },
  { key: 'omi_tutu', label: 'Omi Tutu', meaning: 'Cool Water' },
  { key: 'epo', label: 'Epo', meaning: 'Palm Oil' },
  { key: 'oyin', label: 'Oyin', meaning: 'Honey' },
  { key: 'omi_ero', label: 'Omi Ero', meaning: 'Calming Water' },
  { key: 'omi_omi', label: 'Omi Omi', meaning: 'Sacred Water' },
  { key: 'candles', label: 'Candles', meaning: 'Ritual Candles' },
  { key: 'herbs', label: 'Herbs (Ewe)', meaning: 'Ritual Herbs' },
  { key: 'animal_offerings', label: 'Animal Offerings', meaning: 'Ritual Animal Offerings' },
];

// Recommendation engine based on outcome
function getRecommendedCategories(outcomeType: string, outcomeSubtype: string): string[] {
  const recommendations: Record<string, Record<string, string[]>> = {
    ire: {
      ire_aiku: ['ebo_ipese', 'ebo_ibori'],
      ire_owo: ['ebo_ipese', 'ebo_iranwo'],
      ire_ara: ['ebo_ibori', 'ebo_iwefa'],
      ire_ibiku: ['ebo_isun', 'ebo_ibori'],
      ire_ibasepo: ['ebo_isokan', 'ebo_ipese'],
      ire_irina: ['ebo_isun', 'ebo_ipese'],
      ire_imo: ['ebo_ibori', 'ebo_isokan'],
      ire_ise: ['ebo_iranwo', 'ebo_ipese'],
      ire_idile: ['ebo_isokan', 'ebo_ibori'],
    },
    osogbo: {
      osogbo_iku: ['ebo_riru', 'ebo_isun', 'ebo_itegun'],
      osogbo_arun: ['ebo_iwefa', 'ebo_itegun', 'ebo_ibori'],
      osogbo_epe: ['ebo_itegun', 'ebo_isun', 'ebo_idana'],
      osogbo_ofo: ['ebo_riru', 'ebo_iranwo'],
      osogbo_ewon: ['ebo_riru', 'ebo_isun'],
      osogbo_ogu: ['ebo_riru', 'ebo_isokan'],
      osogbo_ija: ['ebo_isokan', 'ebo_riru'],
      osogbo_iponri: ['ebo_ibori', 'ebo_isokan', 'ebo_iwefa'],
      osogbo_osi: ['ebo_iranwo', 'ebo_ipese', 'ebo_riru'],
    },
  };

  return recommendations[outcomeType]?.[outcomeSubtype] || ['ebo_riru', 'ebo_ipese'];
}

function getRecommendedItems(outcomeType: string, outcomeSubtype: string, eboCategory: string): string[] {
  // Base items for all Ebo
  const baseItems = ['obi', 'omi_tutu'];
  
  // Category-specific items
  const categoryItems: Record<string, string[]> = {
    ebo_riru: ['obi', 'orogbo', 'oti', 'omi_tutu', 'epo'],
    ebo_ipese: ['obi', 'orogbo', 'oyin', 'omi_tutu', 'epo'],
    ebo_ibori: ['obi', 'omi_tutu', 'oyin', 'epo', 'candles'],
    ebo_itegun: ['obi', 'omi_tutu', 'herbs', 'omi_ero'],
    ebo_isun: ['obi', 'omi_tutu', 'candles', 'herbs', 'epo'],
    ebo_iwefa: ['obi', 'omi_tutu', 'omi_ero', 'herbs', 'oyin'],
    ebo_idana: ['obi', 'omi_tutu', 'candles', 'epo', 'herbs'],
    ebo_iranwo: ['obi', 'orogbo', 'omi_tutu', 'oyin'],
    ebo_isokan: ['obi', 'omi_tutu', 'oyin', 'omi_ero', 'candles'],
  };

  // For severe Osogbo, add animal offerings
  const severeOsogbo = ['osogbo_iku', 'osogbo_epe', 'osogbo_arun'];
  let items = categoryItems[eboCategory] || baseItems;
  
  if (outcomeType === 'osogbo' && severeOsogbo.includes(outcomeSubtype)) {
    items = [...items, 'animal_offerings'];
  }

  return [...new Set(items)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check role (must be seller/admin = Awo)
    const { data: profile } = await supabaseClient
      .from('app_340b9f1944_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'seller' && profile.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Awo role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ========== GET CATEGORIES ==========
    if (action === 'categories' && req.method === 'GET') {
      return new Response(JSON.stringify({ categories: EBO_CATEGORIES }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== GET ITEMS ==========
    if (action === 'items' && req.method === 'GET') {
      // Also fetch botanica availability
      const { data: botanicaItems } = await supabaseClient
        .from('app_340b9f1944_botanica_items')
        .select('item_key, name, in_stock, price');

      const itemsWithAvailability = EBO_ITEMS.map(item => {
        const botanica = botanicaItems?.find(b => b.item_key === item.key);
        return {
          ...item,
          botanica_available: botanica?.in_stock || false,
          botanica_price: botanica?.price || null,
        };
      });

      return new Response(JSON.stringify({ items: itemsWithAvailability }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== GET RECOMMENDATIONS ==========
    if (action === 'recommendations' && req.method === 'GET') {
      const consultationId = url.searchParams.get('consultation_id');
      if (!consultationId) {
        return new Response(JSON.stringify({ error: 'consultation_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the Ire/Osogbo outcome for this consultation
      const { data: outcome } = await supabaseClient
        .from('app_340b9f1944_ire_osogbo')
        .select('outcome_type, outcome_subtype')
        .eq('consultation_id', consultationId)
        .single();

      if (!outcome) {
        return new Response(JSON.stringify({ error: 'No Ire/Osogbo outcome found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recommendedCategories = getRecommendedCategories(outcome.outcome_type, outcome.outcome_subtype);
      const recommendedItems = getRecommendedItems(outcome.outcome_type, outcome.outcome_subtype, recommendedCategories[0]);

      return new Response(JSON.stringify({
        recommendations: {
          categories: recommendedCategories,
          items: recommendedItems,
          outcome_type: outcome.outcome_type,
          outcome_subtype: outcome.outcome_subtype,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== GET CONSULTATION EBO ==========
    if (action === 'consultation-ebo' && req.method === 'GET') {
      const consultationId = url.searchParams.get('consultation_id');
      if (!consultationId) {
        return new Response(JSON.stringify({ error: 'consultation_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ebo, error } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .select('*')
        .eq('consultation_id', consultationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ebo: ebo || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== SAVE EBO ==========
    if (action === 'save-ebo' && req.method === 'POST') {
      const body = await req.json();
      const { consultation_id, ebo_category, ebo_items, instructions } = body;

      if (!consultation_id || !ebo_category || !ebo_items || ebo_items.length === 0) {
        return new Response(JSON.stringify({ error: 'consultation_id, ebo_category, and ebo_items are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify Ire/Osogbo is confirmed
      const { data: outcome } = await supabaseClient
        .from('app_340b9f1944_ire_osogbo')
        .select('id')
        .eq('consultation_id', consultation_id)
        .single();

      if (!outcome) {
        return new Response(JSON.stringify({ error: 'Ire/Osogbo must be confirmed before Ebo can be prescribed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if ebo already exists
      const { data: existing } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .select('id')
        .eq('consultation_id', consultation_id)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: 'Ebo already exists for this consultation. Use update instead.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ebo, error } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .insert({
          consultation_id,
          ebo_category,
          ebo_items,
          instructions: instructions || null,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ebo }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== UPDATE EBO ==========
    if (action === 'update-ebo' && req.method === 'PUT') {
      const body = await req.json();
      const { consultation_id, ebo_category, ebo_items, instructions, update_reason } = body;

      if (!consultation_id || !ebo_category || !ebo_items || ebo_items.length === 0) {
        return new Response(JSON.stringify({ error: 'consultation_id, ebo_category, and ebo_items are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get existing ebo
      const { data: existing } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .select('*')
        .eq('consultation_id', consultation_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: 'No existing Ebo found to update' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ebo, error } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .update({
          ebo_category,
          ebo_items,
          instructions: instructions || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
          update_reason: update_reason || null,
          previous_category: existing.ebo_category,
          previous_items: existing.ebo_items,
          previous_instructions: existing.instructions,
        })
        .eq('consultation_id', consultation_id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ebo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== UPDATE EBO STATUS ==========
    if (action === 'update-status' && req.method === 'PUT') {
      const body = await req.json();
      const { consultation_id, status } = body;

      if (!consultation_id || !status) {
        return new Response(JSON.stringify({ error: 'consultation_id and status are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ebo, error } = await supabaseClient
        .from('app_340b9f1944_ebo')
        .update({
          status,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('consultation_id', consultation_id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ebo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});