import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://esm.sh/bcryptjs@2.4.3";

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
    const { password } = await req.json();

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Missing password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hash = Deno.env.get("SHARED_PASSWORD_HASH") || "$2b$10$2DOul6dQ.hVilVwTldwxGOQZlAw5Fz5PRvohw4fNA798aZ..wek6i";
    
    // Compare password with hash using bcryptjs
    const isValid = bcrypt.compareSync(password, hash);

    return new Response(
      JSON.stringify({ success: isValid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
