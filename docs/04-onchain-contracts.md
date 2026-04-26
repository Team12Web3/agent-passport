# 04 — On-chain Contracts

Both contracts deploy to **Avalanche Fuji** (chainId 43113). Solidity ^0.8.20. Foundry.

After deploy, addresses + ABIs go into `packages/contracts/deployments.json` and are imported by the Next.js app.

---

## `AgentPassport.sol`

Append-only registry binding agents to owners and wallets. Mints are gated to a single platform address (us) to keep agent creation gas-free for users during the hackathon.

### Storage

```solidity
struct Passport {
    address owner;            // user's wallet (from Thirdweb)
    address agentWallet;      // agent's EOA (server-managed)
    string  metadataURI;      // optional ipfs:// or https:// — we'll use a JSON blob URL
    bool    active;
    uint64  createdAt;
    uint16  trustScore;       // starts at 50, ticks up on successful actions
}

mapping(uint256 => Passport) public passports;
mapping(address => uint256[]) public agentsByOwner;     // owner → passport ids
mapping(address => uint256)   public passportByWallet;  // agentWallet → passport id (0 = none)
uint256 public nextId = 1;

address public platform;       // immutable after constructor
```

### External functions

```solidity
function mintPassport(
    address owner,
    address agentWallet,
    string calldata metadataURI
) external returns (uint256 id);
// onlyPlatform.
// Reverts if agentWallet is already registered.
// Sets active=true, trustScore=50, createdAt=block.timestamp.
// Emits PassportMinted(id, owner, agentWallet).

function setActive(uint256 id, bool active) external;
// onlyPlatform OR owner of the passport.
// Emits PassportStatusChanged(id, active).

function bumpTrust(uint256 id, uint16 delta) external;
// onlyActionLog (set as a known address).
// Caps at 100.

function getPassport(uint256 id) external view returns (Passport memory);

function passportsOf(address owner) external view returns (uint256[] memory);
```

### Events

```solidity
event PassportMinted(uint256 indexed id, address indexed owner, address indexed agentWallet);
event PassportStatusChanged(uint256 indexed id, bool active);
event TrustScoreChanged(uint256 indexed id, uint16 newScore);
```

### Modifiers

```solidity
modifier onlyPlatform() {
    require(msg.sender == platform, "not platform");
    _;
}
```

### Constructor

```solidity
constructor(address _platform) {
    platform = _platform;
}
```

### Protocol extensions for trusted-agent headers

For the trust protocol, the `passportId` can resolve not just to the wallet binding above, but also to a metadata document or attestation pointer that includes:

- an EAS credential UID
- developer identity
- model platform, such as Claude 3.5
- labels such as `non-crawler`
- the current Terms of Service hash

That is what powers `X-Agent-Passport-ID` as an attribute-proof header.

For the hackathon demo, the passport's `metadataURI` may carry a signed JSON-LD claims packet directly. The request can also repeat that packet in `X-Agent-Claims` plus `X-Agent-Claims-Signature` so a website can compare the request-level attestation with the passport-linked metadata.

---

## `ActionLog.sol`

Append-only audit log of agent actions. One tx per agent task (not per individual action). The actions list is hashed off-chain and stored as a single root for verifiability.

### Storage

```solidity
IAgentPassport public immutable passportContract;
IERC20         public immutable feeToken;     // Fuji USDC
uint256        public actionCount;            // global counter
```

### External functions

```solidity
function logAction(
    uint256 passportId,
    bytes32 taskHash,        // keccak256(prompt || url)
    bytes32 actionsRoot,     // keccak256(JSON.stringify(actions))
    uint256 feeAmount,       // in USDC (6-decimal)
    address beneficiary
) external;
// Verifies msg.sender == passport.agentWallet AND passport.active.
// If feeAmount > 0: pulls feeToken from msg.sender to beneficiary
//   (agent must have approved this contract beforehand).
// Optionally calls passportContract.bumpTrust(passportId, 1).
// Emits ActionLogged(...).
```

### Events

```solidity
event ActionLogged(
    uint256 indexed passportId,
    address indexed agentWallet,
    bytes32 taskHash,
    bytes32 actionsRoot,
    uint256 feeAmount,
    address beneficiary,
    uint256 blockTimestamp
);
```

### Constructor

```solidity
constructor(address _passport, address _feeToken) {
    passportContract = IAgentPassport(_passport);
    feeToken         = IERC20(_feeToken);
}
```

After deploy, call `AgentPassport.setActionLog(address)` (a one-shot setter) so `bumpTrust` can be invoked.

---

## Staking / slashing companion flow

To prevent malicious agents, the protocol now pairs the passport with a simple `StakeVault` companion contract keyed by `passportId`:

```solidity
function depositStake(uint256 passportId) external payable;
function slashStake(uint256 passportId, uint256 amount, bytes32 evidenceHash) external;
function getStake(uint256 passportId) external view returns (uint256 activeStake, uint256 totalSlashed, uint64 lastStakeAt);
```

The website can submit signed request evidence when it detects obvious abuse such as a DDoS pattern. A demo-friendly default is `0.1 ETH` staked per passport ID. Once the evidence is verified, that stake can be slashed. The same stake summary can also be checked in middleware before high-value content is returned.

This is what gives `X-Agent-Signature` economic consequences rather than just identity value.

---

## Session-key authorization companion flow

To prove "this is your agent," the protocol can pair the passport with an on-chain session-key registry:

```solidity
function authorizeSessionKey(uint256 passportId, address sessionKey, uint64 expiresAt) external;
function revokeSessionKey(uint256 passportId, address sessionKey) external;
function isAuthorizedSessionKey(uint256 passportId, address sessionKey) external view returns (bool);
```

When the middleware verifies `X-Agent-Signature`, it can recover the signer and then confirm that the signer is a valid session key authorized by the owner's main wallet.

For the hackathon demo, we simulate these ERC-4337-style semantics with:

- `X-Agent-Session-Grant` - an owner-scoped delegation document carrying `sessionKey`, `expiresAt`, `allowedOrigins`, `allowedActions`, and `maxAmountUsd`
- `X-Agent-Session-Proof` - the owner wallet's signature over that delegation document

That gives us the "employee ID" behavior without wiring a full smart-account validator module under time pressure.

---

## ZK intent-proof companion flow

To ensure operations are trusted, the protocol can attach an intent hash to the user's original command and verify that the current action derives from it:

```solidity
function verifyIntentProof(
    uint256 passportId,
    bytes32 intentHash,
    bytes32 actionHash,
    bytes calldata proof
) external view returns (bool);
```

For the hackathon demo, the proof backend can be stubbed with an ECDSA-signed proof flow instead of a full zkVM:

- keep `X-Agent-Intent-Hash`
- add `X-Agent-Action-Hash`
- add `X-Agent-Intent-Proof`
- sign `(passportId, timestamp, intentHash, actionHash)` with the trusted agent/session signer

That gives us a clear "Verifiable Intents" logic flow without hand-writing custom ZK circuits under time pressure. A production version can swap this proof payload for a real RISC Zero receipt later without changing the higher-level header story.

---

## Deploy script — `Deploy.s.sol`

```solidity
// script/Deploy.s.sol
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PLATFORM_PRIVATE_KEY");
        address platform = vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(pk);
        AgentPassport passport = new AgentPassport(platform);
        ActionLog log = new ActionLog(address(passport), usdc);
        passport.setActionLog(address(log));
        vm.stopBroadcast();

        console.log("AgentPassport:", address(passport));
        console.log("ActionLog:    ", address(log));
    }
}
```

After running, write `deployments.json`:

```json
{
  "network": "fuji",
  "chainId": 43113,
  "AgentPassport": {
    "address": "0x...",
    "abi": [...]
  },
  "ActionLog": {
    "address": "0x...",
    "abi": [...]
  },
  "USDC": {
    "address": "0x5425890298aed601595a70AB815c96711a31Bc65"
  }
}
```

---

## Tests (must pass before deploying)

`AgentPassport.t.sol`:
- ✅ `mintPassport` succeeds when called by platform
- ✅ `mintPassport` reverts when called by non-platform
- ✅ `mintPassport` reverts on duplicate `agentWallet`
- ✅ `setActive` succeeds for platform and owner; reverts for others
- ✅ `passportsOf` returns correct list
- ✅ `bumpTrust` only callable from ActionLog address; caps at 100

`ActionLog.t.sol`:
- ✅ `logAction` succeeds when caller is the registered agentWallet
- ✅ `logAction` reverts when caller is not the agentWallet
- ✅ `logAction` reverts when passport is inactive
- ✅ `logAction` with `feeAmount > 0` transfers USDC correctly
- ✅ `logAction` with `feeAmount == 0` skips transfer
- ✅ `ActionLogged` event has correct fields

Run: `forge test -vv`

---

## Gas / cost notes

- Mint passport: ~80k gas (~0.0002 AVAX on Fuji).
- Log action: ~60k gas + ERC20 transfer if fee > 0 (~0.00015 AVAX).
- Each agent gets pre-funded with 0.05 AVAX (enough for ~300 log actions).

## Why no upgradeability

These are hackathon contracts. Immutable + fast deploys. If we find a bug, we redeploy and update `deployments.json`. The DB references `passportId` only, so it survives a fresh deploy as long as we re-mint.

## Reading from the frontend (viem)

```ts
import deployments from "@/../packages/contracts/deployments.json";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
});

const passport = await client.readContract({
  address: deployments.AgentPassport.address,
  abi: deployments.AgentPassport.abi,
  functionName: "getPassport",
  args: [42n],
});
```
