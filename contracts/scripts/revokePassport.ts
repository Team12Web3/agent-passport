import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const contractAddress = process.env.AGENT_PASSPORT_CONTRACT;
  const passportId = process.env.AGENT_PASSPORT_ID ?? "1";

  if (!contractAddress) throw new Error("Missing AGENT_PASSPORT_CONTRACT");

  const agentPassport = await ethers.getContractAt("AgentPassport", contractAddress);
  const tx = await agentPassport.revokePassport(passportId);
  const receipt = await tx.wait();

  console.log("Revoked passport:", passportId);
  console.log("Revoke tx:", receipt?.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
