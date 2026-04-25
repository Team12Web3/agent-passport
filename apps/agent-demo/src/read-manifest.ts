import "dotenv/config";

async function main() {
  const targetBaseUrl = process.env.TARGET_BASE_URL ?? "http://localhost:3001";
  const response = await fetch(`${targetBaseUrl}/.well-known/agent-access.json`);
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
