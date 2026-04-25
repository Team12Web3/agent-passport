"use client";

import Link from "next/link";

type LoginButtonProps = {
  variant?: "primary" | "ghost";
  className?: string;
  label?: string;
};

export function LoginButton({
  variant = "primary",
  className = "",
  label = "Continue with email"
}: LoginButtonProps) {
  const styles =
    variant === "ghost"
      ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
      : "bg-[var(--accent)] text-white shadow-[0_18px_50px_rgba(232,65,66,0.28)] hover:bg-[#d63435]";

  return (
    <Link
      href="/dashboard?onboard=1"
      className={`inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition ${styles} ${className}`.trim()}
    >
      {label}
    </Link>
  );
}
