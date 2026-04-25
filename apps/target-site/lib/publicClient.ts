import { createPublicClient, http } from "viem";
import { avalancheFuji } from "./chains";

export const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(),
});
