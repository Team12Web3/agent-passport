import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const contractAddress = process.env.AGENT_PASSPORT_CONTRACT;
  const agentWallet = process.env.AGENT_WALLET_ADDRESS;

  if (!contractAddress) throw new Error("Missing AGENT_PASSPORT_CONTRACT");
  if (!agentWallet) throw new Error("Missing AGENT_WALLET_ADDRESS");

  const metadataURI =
    process.env.AGENT_METADATA_URI ??
    "ipfs://demo-agent-passport-metadata-or-https-json-url";

  const capabilities = process.env.AGENT_CAPABILITIES ?? "read_products,compare_prices";
  const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes(capabilities));

  const agentPassport = await ethers.getContractAt("AgentPassport", contractAddress);
  const tx = await agentPassport.mintPassport(agentWallet, metadataURI, capabilitiesHash);
  const receipt = await tx.wait();

  console.log("Mint tx:", receipt?.hash);
  console.log("Agent wallet:", agentWallet);
  console.log("Capabilities hash:", capabilitiesHash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
