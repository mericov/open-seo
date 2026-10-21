import { useState } from "react";
import type { LeadMailClient } from "@/shared/leadEmail";

const STORAGE_KEY = "leadMailClient";

function readStored(): LeadMailClient {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "mailto"
      ? "mailto"
      : "gmail";
  } catch {
    return "gmail";
  }
}

export function useMailClient() {
  const [client, setClient] = useState<LeadMailClient>(readStored);
  const change = (next: LeadMailClient) => {
    setClient(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  };
  return [client, change] as const;
}
