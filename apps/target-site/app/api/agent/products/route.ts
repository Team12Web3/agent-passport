import { NextRequest, NextResponse } from "next/server";
import { type Address, type Hex, isAddress } from "viem";

import { agentPassportAbi } from "@/lib/agentPassportAbi";
import {
  AGENT_ACCESS_TYPES,
  getAgentAccessDomain,
  type AgentAccessMessage,
} from "@/lib/agentAccess";
import { jsonError } from "@/lib/errorResponse";
import { maybeRecordAccess } from "@/lib/recordAccess";
import { publicClient } from "@/lib/publicClient";

export const dynamic = "force-dynamic";

const REQUIRED_HEADERS = [
  "x-agent-address",
  "x-agent-passport-id",
  "x-agent-chain-id",
  "x-agent-domain",
  "x-agent-path",
  "x-agent-intent",
  "x-agent-nonce",
  "x-agent-deadline",
  "x-agent-signature",
] as const;

const PRODUCTS = [
  {
    id: "sku_001",
    name: "Noise-Cancelling Headphones",
    priceUsd: 129,
    rating: 4.7,
    stock: 12,
  },
  {
    id: "sku_002",
    name: "Portable AI Dev Kit",
    priceUsd: 249,
    rating: 4.9,
    stock: 4,
  },
  {
    id: "sku_003",
    name: "USB-C Travel Hub",
    priceUsd: 39,
    rating: 4.5,
    stock: 31,
  },
];

function missingHeaders(req: NextRequest) {
  return REQUIRED_HEADERS.filter((header) => !req.headers.get(header));
}

function getHeader(req: NextRequest, key: string) {
  return req.headers.get(key)?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const missing = missingHeaders(req);

  if (missing.length > 0) {
    return jsonError("Missing required agent headers.", 400, {
      missing,
      discovery: "/.well-known/agent-access.json",
    });
  }

  const agentAddressRaw = getHeader(req, "x-agent-address");
  const passportIdRaw = getHeader(req, "x-agent-passport-id");
  const chainIdRaw = getHeader(req, "x-agent-chain-id");
  const targetDomain = getHeader(req, "x-agent-domain");
  const path = getHeader(req, "x-agent-path");
  const intent = getHeader(req, "x-agent-intent");
  const nonceRaw = getHeader(req, "x-agent-nonce");
  const deadlineRaw = getHeader(req, "x-agent-deadline");
  const signature = getHeader(req, "x-agent-signature") as Hex;

  if (!isAddress(agentAddressRaw)) {
    return jsonError("Invalid x-agent-address.", 400);
  }

  if (!signature.startsWith("0x")) {
    return jsonError("Invalid x-agent-signature.", 400);
  }

  if (chainIdRaw !== "43113") {
    return jsonError("Wrong chain. Expected Avalanche Fuji chain ID 43113.", 400, {
      received: chainIdRaw,
    });
  }

  let passportId: bigint;
  let nonce: bigint;
  let deadline: bigint;

  try {
    passportId = BigInt(passportIdRaw);
    nonce = BigInt(nonceRaw);
    deadline = BigInt(deadlineRaw);
  } catch {
    return jsonError("Invalid bigint header value.", 400);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  if (deadline < now) {
    return jsonError("Agent request signature expired.", 401, {
      now: now.toString(),
      deadline: deadline.toString(),
    });
  }

  const expectedPath = "/api/agent/products";

  if (path !== expectedPath) {
    return jsonError("Signed path does not match requested endpoint.", 401, {
      expectedPath,
      receivedPath: path,
    });
  }

  const allowedIntents = new Set(["compare_products", "read_products"]);

  if (!allowedIntents.has(intent)) {
    return jsonError("Intent is not allowed for this endpoint.", 403, {
      allowedIntents: [...allowedIntents],
      receivedIntent: intent,
    });
  }

  const host = req.headers.get("host") ?? "";
  const configuredDomain = process.env.NEXT_PUBLIC_TARGET_DOMAIN;
  const allowedDomains = new Set([host, configuredDomain, "localhost:3001"].filter(Boolean));

  if (!allowedDomains.has(targetDomain)) {
    return jsonError("Signed target domain does not match this website.", 401, {
      targetDomain,
      host,
      configuredDomain,
    });
  }

  const contractAddress = process.env.AGENT_PASSPORT_CONTRACT as Address | undefined;

  if (!contractAddress || !isAddress(contractAddress)) {
    return jsonError("Server is missing a valid AGENT_PASSPORT_CONTRACT.", 500);
  }

  const agentAddress = agentAddressRaw as Address;

  const message: AgentAccessMessage = {
    agent: agentAddress,
    passportId,
    targetDomain,
    path,
    intent,
    nonce,
    deadline,
  };

  let signatureValid = false;

  try {
    signatureValid = await publicClient.verifyTypedData({
      address: agentAddress,
      domain: getAgentAccessDomain(contractAddress),
      types: AGENT_ACCESS_TYPES,
      primaryType: "AgentRequest",
      message,
      signature,
    });
  } catch (error) {
    return jsonError("Failed to verify typed signature.", 401, {
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (!signatureValid) {
    return jsonError("Invalid agent signature.", 401);
  }

  let passportValid = false;

  try {
    passportValid = await publicClient.readContract({
      address: contractAddress,
      abi: agentPassportAbi,
      functionName: "isValidAgent",
      args: [passportId, agentAddress],
    });
  } catch (error) {
    return jsonError("Failed to read AgentPassport contract.", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (!passportValid) {
    return jsonError("Agent passport is not valid or has been revoked.", 403, {
      passportId: passportId.toString(),
      agent: agentAddress,
    });
  }

  const accessRecord = await maybeRecordAccess({
    contractAddress,
    passportId,
    agentAddress,
    targetDomain,
    intent,
  }).catch((error) => ({
    attempted: true as const,
    error: error instanceof Error ? error.message : "Unknown error",
  }));

  return NextResponse.json({
    ok: true,
    status: "verified_agent",
    network: "Avalanche Fuji C-Chain",
    chainId: 43113,
    passportId: passportId.toString(),
    agent: agentAddress,
    intent,
    allowedActions: ["read_products", "compare_prices"],
    agentMode: true,
    data: {
      products: PRODUCTS,
    },
    trustControls: {
      verifiedSignature: true,
      checkedPassportContract: true,
      revocableByController: true,
      requestBoundToDomain: true,
      requestBoundToPath: true,
      requestExpiresAt: deadline.toString(),
      nonce: nonce.toString(),
    },
    avalancheAccessRecord: accessRecord,
  });
}
