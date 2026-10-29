import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Tema awal dari URL (main process menulis ?theme=) supaya tidak berkedip sebelum state pertama tiba.
if (new URLSearchParams(location.search).get("theme") === "dark") document.documentElement.classList.add("dark");

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: (n, err) => n < 2 && !(err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
