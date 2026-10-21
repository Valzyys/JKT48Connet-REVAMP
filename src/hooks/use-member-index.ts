import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { q } from "@/lib/queries";

/**
 * Peta url_key → foto member. Lineup di daftar theater/jadwal tidak membawa foto,
 * jadi foto dicocokkan dari /api/member (di-cache lama oleh React Query).
 */
export function useMemberPhotos() {
  const members = useQuery(q.members());
  return useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m.img])), [members.data]);
}
