"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to changes on `transactions` and re-runs the server component fetch whenever a
// tenant submits a new payment (or another admin acts on one) — no polling.
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("verification-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
