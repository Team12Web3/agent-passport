import "server-only";
import deployments from "../../../../packages/contracts/deployments.json";
import type { Hex } from "viem";

type Deployment = { address: Hex; abi: unknown[] };

const dep = deployments as unknown as {
  network: string;
  chainId: number;
  AgentPassport: Deployment;
  ActionLog: Deployment;
  USDC: { address: Hex };
};

export const AgentPassport = {
  address: dep.AgentPassport.address,
  abi: dep.AgentPassport.abi as readonly unknown[],
} as const;

export const ActionLog = {
  address: dep.ActionLog.address,
  abi: dep.ActionLog.abi as readonly unknown[],
} as const;

export const USDC = {
  address: dep.USDC.address,
  abi: [
    {
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount",  type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      type: "function",
      name: "allowance",
      stateMutability: "view",
      inputs: [
        { name: "owner",   type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      type: "function",
      name: "transfer",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to",     type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ] as const,
} as const;

export const NETWORK = dep.network;
export const CHAIN_ID = dep.chainId;

export function assertContractsDeployed(): void {
  const zero = "0x0000000000000000000000000000000000000000";
  if (AgentPassport.address.toLowerCase() === zero) {
    throw new Error(
      "AgentPassport address is zero — run `pnpm contracts:deploy` and update deployments.json",
    );
  }
  if (ActionLog.address.toLowerCase() === zero) {
    throw new Error(
      "ActionLog address is zero — run `pnpm contracts:deploy` and update deployments.json",
    );
  }
}
