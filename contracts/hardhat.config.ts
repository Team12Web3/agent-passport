import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const FUJI_PRIVATE_KEY = process.env.FUJI_PRIVATE_KEY ?? "";
const AVALANCHE_FUJI_RPC_URL =
  process.env.AVALANCHE_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";

const accounts = FUJI_PRIVATE_KEY.startsWith("0x") ? [FUJI_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    fuji: {
      url: AVALANCHE_FUJI_RPC_URL,
      chainId: 43113,
      accounts,
    },
  },
};

export default config;
