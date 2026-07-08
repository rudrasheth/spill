import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, postId } = await req.json();

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean base64 prefix if present (e.g. "data:image/png;base64,...")
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. Defaulting to mock bypass.");
      // Fallback/mock response for testing/development if key isn't configured yet
      return new Response(
        JSON.stringify({
          safe: true,
          category: "none",
          confidence: 1.0,
          action: "allow"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini API (using gemini-1.5-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              text: 'Classify this image for content safety. Return JSON only in this exact structure: { "safe": boolean, "category": "none" | "explicit_sexual" | "graphic_violence" | "self_harm" | "csam_suspected" | "contains_pii" | "weapon" | "other_concern", "confidence": number }. Be conservative — if uncertain, mark unsafe: true/false. Do not output markdown code blocks (like ```json), return raw JSON text.'
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API call failed:", errorText);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    console.log("Gemini Raw Response:", responseText);

    let classification;
    try {
      classification = JSON.parse(responseText.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini response text as JSON. Raw text:", responseText);
      // Fallback if parsing fails — conservative reject
      classification = { safe: false, category: "other_concern", confidence: 0.5 };
    }

    const { safe, category, confidence } = classification;
    let action = "allow";

    // Initialize Supabase Client with Service Role Key to perform admin tasks if needed
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Business Logic based on categories
    if (!safe || category === "explicit_sexual" || category === "graphic_violence" || category === "self_harm" || category === "weapon") {
      action = "reject";
    }

    if (category === "csam_suspected") {
      action = "silent_reject";
      console.error("CRITICAL SAFETY WARNING: CSAM SUSPECTED on upload attempt.");
      
      // Store report silently in database for operator to review manually, but do not save post or notify user
      if (postId) {
        await supabase.from("moderation_flags").insert([{
          post_id: postId,
          category: "csam_suspected",
          confidence: confidence ?? 1.0
        }]);
      } else {
        await supabase.from("moderation_flags").insert([{
          category: "csam_suspected",
          confidence: confidence ?? 1.0
        }]);
      }
    }

    if (category === "contains_pii") {
      action = "blur"; // Client-side signal to auto-blur bounding boxes/regions
    }

    // Routing low-confidence results to pending review state
    if (safe && confidence < 0.6) {
      action = "pending_review";
    }

    return new Response(
      JSON.stringify({
        safe,
        category,
        confidence,
        action
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in moderate-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
