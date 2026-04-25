"use client";

import { useActiveAccount, useActiveWallet } from "thirdweb/react";

export function useAuth() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();

  return {
    user: account ?? null,
    address: account?.address as `0x${string}` | undefined,
    isLoggedIn: !!account,
    isLoading: !account && !!wallet,
  };
}
