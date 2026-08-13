import { supabase } from "@/integrations/supabase/client";

export type StoredPosition = { x: number; y: number };
export type MindmapLayout = {
  id: string | null;
  positions: Record<string, StoredPosition>;
  updatedAt: string | null;
  updatedBy: string | null;
};

const EMPTY: MindmapLayout = { id: null, positions: {}, updatedAt: null, updatedBy: null };

/** Charge la disposition enregistrée des nœuds de la mindmap. */
export async function fetchMindmapLayout(): Promise<MindmapLayout> {
  const { data } = await supabase
    .from("mindmap_config")
    .select("id,nodes,updated_at,updated_by")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return EMPTY;

  const positions: Record<string, StoredPosition> = {};
  const rows = Array.isArray(data.nodes) ? (data.nodes as unknown[]) : [];
  for (const row of rows) {
    const node = row as { id?: unknown; position?: { x?: unknown; y?: unknown } };
    if (typeof node.id !== "string") continue;
    const x = node.position?.x;
    const y = node.position?.y;
    if (typeof x !== "number" || typeof y !== "number") continue;
    positions[node.id] = { x, y };
  }

  return {
    id: data.id,
    positions,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

/** Enregistre la disposition courante (réservé au Bureau via les règles d'accès). */
export async function saveMindmapLayout(params: {
  layoutId: string | null;
  nodes: { id: string; type?: string | undefined; position: StoredPosition }[];
  edges: { id: string; source: string; target: string }[];
  userId: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const payload = {
    nodes: params.nodes.map((n) => ({
      id: n.id,
      type: n.type ?? null,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: params.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    updated_by: params.userId,
  };

  if (params.layoutId) {
    const { error } = await supabase
      .from("mindmap_config")
      .update(payload as never)
      .eq("id", params.layoutId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: params.layoutId };
  }

  const { data, error } = await supabase
    .from("mindmap_config")
    .insert(payload as never)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id ?? undefined };
}

/** Supprime la disposition mémorisée : la mindmap repart de la mise en page automatique. */
export async function resetMindmapLayout(layoutId: string | null) {
  if (!layoutId) return { ok: true };
  const { error } = await supabase.from("mindmap_config").delete().eq("id", layoutId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Résout l'identifiant de nœud d'un projet (colonne mindmap_node_id, sinon son id). */
export function projectNodeId(project: { id: string; mindmap_node_id?: string | null }) {
  return project.mindmap_node_id ?? project.id;
}
