import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentPassport with account:", deployer.address);

  const AgentPassport = await ethers.getContractFactory("AgentPassport");
  const agentPassport = await AgentPassport.deploy();
  await agentPassport.waitForDeployment();

  const address = await agentPassport.getAddress();
  console.log("AgentPassport deployed to:", address);
  console.log("Add this to apps/target-site/.env.local and apps/agent-demo/.env:");
  console.log(`AGENT_PASSPORT_CONTRACT=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
