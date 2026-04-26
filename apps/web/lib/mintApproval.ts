import { stringToHex, type Hex } from "viem";

export function mintApprovalMessage(owner: string, name: string): string {
  return `agent-passport:mint-approval:${owner.toLowerCase()}:${name}`;
}

export function mintApprovalData(owner: string, name: string): Hex {
  return stringToHex(mintApprovalMessage(owner, name));
}
