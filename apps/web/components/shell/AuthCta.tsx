"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type AuthCtaProps = {
  className: string;
  loggedOutLabel: string;
  loggedInLabel: string;
  iconClassName: string;
  hintClassName?: string;
  loggedOutHint?: string;
  loggedInHint?: string;
};

export function AuthCta({
  className,
  loggedOutLabel,
  loggedInLabel,
  iconClassName,
  hintClassName,
  loggedOutHint,
  loggedInHint,
}: AuthCtaProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const hint = isLoggedIn ? loggedInHint : loggedOutHint;

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { loggedIn?: boolean };
        if (!cancelled) {
          setIsLoggedIn(!!data.loggedIn);
        }
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
        }
      }
    }

    loadAuthStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Link href={isLoggedIn ? "/dashboard" : "/login"} className={className}>
        {isLoggedIn ? loggedInLabel : loggedOutLabel}
        <ArrowRight className={iconClassName} />
      </Link>
      {hint ? <span className={hintClassName}>{hint}</span> : null}
    </>
  );
}
