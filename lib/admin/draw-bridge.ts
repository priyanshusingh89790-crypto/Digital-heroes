import "server-only";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { simulateDraw as simulateDrawEngineOperation, publishDraw as publishDrawEngineOperation } from "@/lib/draw/operations";

const idSchema = z.string().uuid();

/**
 * The draw engine returns simulation numbers but the original simulation operation
 * only stored them inside audit metadata. Persisting them on the simulated draw is
 * necessary so publishing the simulated draw publishes exactly what the admin saw.
 */
export async function simulateAdminDraw(drawId: string, seed?: string) {
  await requireAdmin();
  const id = idSchema.parse(drawId);
  const simulation = await simulateDrawEngineOperation({ draw_id: id, seed });
  const db = createAdminClient();
  const { error } = await db.from("draws").update({ numbers: simulation.drawResult.numbers }).eq("id", id).eq("status", "simulated");
  if (error) throw new Error(`Simulation generated successfully but could not persist draw numbers: ${error.message}`);
  return simulation;
}

export async function publishAdminDraw(drawId: string) {
  await requireAdmin();
  return publishDrawEngineOperation({ draw_id: idSchema.parse(drawId) });
}
