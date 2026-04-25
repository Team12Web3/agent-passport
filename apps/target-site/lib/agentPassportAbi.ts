export const agentPassportAbi = [
  {
    type: "function",
    name: "isValidAgent",
    stateMutability: "view",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
      },
      {
        name: "agentWallet",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },
  {
    type: "function",
    name: "recordAccess",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
      },
      {
        name: "agentWallet",
        type: "address",
      },
      {
        name: "targetHash",
        type: "bytes32",
      },
      {
        name: "intentHash",
        type: "bytes32",
      },
    ],
    outputs: [],
  },
] as const;
