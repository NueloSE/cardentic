import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Public client — for reads and user-submitted registrations */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Admin client — for trusted server-side writes (webhook, boss agent) */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface Agent {
  id: string;
  name: string;
  description: string;
  category: "travel" | "finance" | "research" | "utilities" | "other";
  endpoint_url: string;
  stellar_address: string;
  price_usdc: number;
  owner_name: string | null;
  owner_email: string | null;
  is_active: boolean;
  created_at: string;
}
