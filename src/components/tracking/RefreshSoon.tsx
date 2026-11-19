"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RefreshSoon({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms);
    const stop = setTimeout(() => clearInterval(id), 60_000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [router, ms]);
  return null;
}
