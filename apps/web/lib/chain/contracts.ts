import "server-only";
import deployments from "../../../../packages/contracts/deployments.json";
import type { Hex } from "viem";

type Deployment = { address: Hex; abi: unknown[] };

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Hex;

const dep = deployments as unknown as {
  network: string;
  chainId: number;
  AgentPassport: Deployment;
  ActionLog: Deployment;
  StakeVault?: Deployment;
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

export const StakeVault = {
  address: dep.StakeVault?.address ?? ZERO_ADDRESS,
  abi: [
    {
      type: "function",
      name: "depositStake",
      stateMutability: "payable",
      inputs: [{ name: "passportId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "slashStake",
      stateMutability: "nonpayable",
      inputs: [
        { name: "passportId", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "evidenceHash", type: "bytes32" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "getStake",
      stateMutability: "view",
      inputs: [{ name: "passportId", type: "uint256" }],
      outputs: [
        { name: "activeStake", type: "uint256" },
        { name: "totalSlashed", type: "uint256" },
        { name: "lastStakeAt", type: "uint64" },
      ],
    },
  ] as const,
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
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      type: "function",
      name: "allowance",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      type: "function",
      name: "transfer",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
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

export function hasStakeVaultConfigured(): boolean {
  return StakeVault.address.toLowerCase() !== ZERO_ADDRESS;
}

export function assertContractsDeployed(): void {
  if (AgentPassport.address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "AgentPassport address is zero - run `pnpm contracts:deploy` and update deployments.json",
    );
  }
  if (ActionLog.address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "ActionLog address is zero - run `pnpm contracts:deploy` and update deployments.json",
    );
  }
}
