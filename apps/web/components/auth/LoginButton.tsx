"use client";

import { ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";

import { fuji, tw } from "@/lib/thirdweb/client";

export function LoginButton() {
  return (
    <ConnectButton
      client={tw}
      chain={fuji}
      auth={{
        getLoginPayload: async ({ address }) => {
          const response = await fetch(
            `/api/auth/payload?address=${encodeURIComponent(address)}`,
          );
          if (!response.ok) {
            throw new Error("Failed to generate login payload");
          }
          return response.json();
        },
        doLogin: async (params) => {
          const loginResponse = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });
          if (!loginResponse.ok) {
            throw new Error("Failed to login with thirdweb auth");
          }

          const syncResponse = await fetch("/api/auth/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: null }),
          });
          if (!syncResponse.ok) {
            throw new Error("Failed to sync user profile");
          }
        },
        isLoggedIn: async () => {
          const response = await fetch("/api/auth/status", {
            cache: "no-store",
          });
          if (!response.ok) {
            return false;
          }
          const data = (await response.json()) as { loggedIn?: boolean };
          return !!data.loggedIn;
        },
        doLogout: async () => {
          await fetch("/api/auth/logout", { method: "POST" });
        },
      }}
      wallets={[
        inAppWallet({
          auth: { options: ["email"] },
        }),
        createWallet("io.metamask"),
      ]}
      connectButton={{ label: "Continue with email" }}
    />
  );
}
