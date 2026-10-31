"use client";
import { createContext, useContext } from "react";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
};
export const SessionContext = createContext<SessionUser | null>(null);
export function useUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Session required");
  return user;
}
