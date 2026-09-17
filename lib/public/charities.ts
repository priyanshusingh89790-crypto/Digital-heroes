import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PublicCharity = { id: string; name: string; slug: string; short_description: string; description: string; website_url: string | null; image_path: string | null; is_featured: boolean; is_active: boolean };
export type CharityEvent = { id: string; title: string; description: string | null; starts_at: string; location: string | null; registration_url: string | null };

// Search/filter schema
const charitySearchSchema = z.object({
  search: z.string().optional(),
  featured: z.boolean().optional(),
});

export type CharitySearchParams = z.infer<typeof charitySearchSchema>;

export async function getCharities(params?: CharitySearchParams) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("charities")
      .select("id, name, slug, short_description, description, website_url, image_path, is_featured, is_active")
      .order("is_featured", { ascending: false })
      .order("name");

    // Validate params using schema
    const validatedParams = params ? charitySearchSchema.parse(params) : params;

    // Apply search filter
    if (validatedParams?.search) {
      query = query.ilike("name", `%${validatedParams.search}%`);
    }

    // Apply featured filter
    if (validatedParams?.featured !== undefined) {
      query = query.eq("is_featured", validatedParams.featured);
    }

    const { data, error } = await query;
    if (error) return { charities: [] as PublicCharity[], error: "We couldn't load charities right now." };
    return { charities: (data ?? []) as PublicCharity[], error: null };
  } catch {
    return { charities: [] as PublicCharity[], error: "We couldn't load charities right now." };
  }
}

export async function getCharityBySlug(slug: string) {
  try {
    const supabase = await createClient();
    const { data: charity, error } = await supabase
      .from("charities")
      .select("id, name, slug, short_description, description, website_url, image_path, is_featured")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !charity) return { charity: null, events: [] as CharityEvent[], error: error ? "We couldn't load this charity right now." : null };
    const { data: events } = await supabase
      .from("charity_events")
      .select("id, title, description, starts_at, location, registration_url")
      .eq("charity_id", charity.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at");
    return { charity: charity as PublicCharity, events: (events ?? []) as CharityEvent[], error: null };
  } catch { return { charity: null, events: [] as CharityEvent[], error: "We couldn't load this charity right now." }; }
}

export async function getFeaturedCharity() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("charities")
      .select("id, name, slug, short_description, description, website_url, image_path, is_featured")
      .eq("is_featured", true)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { charity: null, error: "We couldn't load the featured charity." };
    return { charity: data as PublicCharity | null, error: null };
  } catch {
    return { charity: null, error: "We couldn't load the featured charity." };
  }
}
