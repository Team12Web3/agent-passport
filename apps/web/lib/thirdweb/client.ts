import { createThirdwebClient } from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";

const clientId = process.env.NEXT_PUBLIC_TW_CLIENT_ID;

if (!clientId) {
  throw new Error("Missing NEXT_PUBLIC_TW_CLIENT_ID");
}

export const tw = createThirdwebClient({ clientId });
export const fuji = avalancheFuji;
