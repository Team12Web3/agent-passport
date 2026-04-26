"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AutoConnect, ThirdwebProvider } from "thirdweb/react";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { supportedWallets } from "@/lib/thirdweb/wallets";

export default function Providers({ children }: { children: ReactNode }) {
  const client = getThirdwebClient();
  const pathname = usePathname();
  const autoConnectEnabled = pathname !== "/login";

  return (
    <ThirdwebProvider>
      {client && autoConnectEnabled && (
        <AutoConnect client={client} wallets={supportedWallets} timeout={10_000} />
      )}
      {children}
    </ThirdwebProvider>
  );
}
