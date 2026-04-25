import { inAppWallet, createWallet } from "thirdweb/wallets";

export const supportedWallets = [inAppWallet(), createWallet("io.metamask")];
