import React from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PriceDisplayProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps price content — shows it only when authenticated.
 * Guests see nothing (prices are hidden, no "sign in" prompt).
 */
export function PriceDisplay({ children, className = "" }: PriceDisplayProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

interface AuthGatedCartButtonProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps add-to-cart buttons — always visible to all users.
 * Guests can add to cart; login is enforced at checkout.
 */
export function AuthGatedCartButton({ children }: AuthGatedCartButtonProps) {
  return <>{children}</>;
}
