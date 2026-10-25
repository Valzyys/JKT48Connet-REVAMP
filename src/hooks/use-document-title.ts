import { useEffect } from "react";
import { clip, fullTitle } from "@/lib/seo";

/** Judul tab & meta description mengikuti halaman (worker/seo.ts mengisi yang sama di HTML awal). */
export function useDocumentTitle(title?: string, description?: string) {
  useEffect(() => {
    if (!title) return;
    document.title = fullTitle(title);
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", clip(description));
  }, [title, description]);
}
