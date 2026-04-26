import deployments from "@contracts/deployments.json";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type DeploymentShape = {
  AgentPassport?: { address?: string };
};

const deployment = deployments as DeploymentShape;
const agentPassportAddress = deployment.AgentPassport?.address ?? "";

export const DEPLOYED_AGENT_PASSPORT_ADDRESS = ADDRESS_RE.test(agentPassportAddress)
  ? agentPassportAddress
  : "";

