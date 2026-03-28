# starkzappypay ⚡

![Starknet Mainnet](https://img.shields.io/badge/Starknet-Mainnet-brightgreen?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNGRjQ3NTAiLz48L3N2Zz4=)
![Gasless](https://img.shields.io/badge/Gas%20Fees-Sponsored-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-0.2.0-orange?style=for-the-badge)

> Gasless crypto tip links on Starknet. No wallet setup. No gas fees. Just a link.

**starkzappypay** lets anyone create a shareable payment link and receive STRK, USDC, or ETH from anyone — using only a social login (Email, Farcaster). Built on Starknet using the [Starkzap SDK](https://docs.starknet.io/build/starkzap/overview).

---

## Live Demo

🔗 **[starkzappypay.vercel.app](https://starkzappypay.vercel.app)** *(update with your deployed URL)*

---

## How It Works

### For creators
1. Enter an optional username (e.g. `@alice`) and your Starknet address
2. Add an optional message — "Buy me a coffee ☕"
3. Optionally set a preferred receive token, a tip goal label, and target amount
4. Hit **Generate** — your link is saved and ready: `/pay/@alice`
5. Share it in your bio, Linktree, or anywhere

### For tippers
1. Open the creator's link — `starkzappypay.vercel.app/pay/@alice`
2. The username resolves to the creator's address automatically
3. Sign in with Email or Farcaster — no seed phrase, no wallet extension
4. Pick a token (STRK, USDC, ETH), enter an amount, hit Send
5. If your token differs from the creator's preferred token, it's auto-swapped via AVNU
6. Done — zero gas paid

---

## Features

| Feature | Details |
|---------|---------|
| **Username links** | `/pay/@alice` — clean, human-readable, globally resolvable |
| **Persistent usernames** | Username → address stored in Supabase, works on any device |
| **Gasless transactions** | AVNU Paymaster sponsors all fees — tippers never pay gas |
| **Social login** | Privy embedded wallet — email, Google, Apple, Twitter, Discord |
| **No seed phrase** | EVM embedded wallet derives a Starknet key via `grindKey` |
| **Auto account deploy** | Argent account deployed on first use, fee sponsored |
| **Multi-token** | STRK, USDC, ETH — tipper picks at send time |
| **Token auto-swap** | Tipper sends any token; creator receives their preferred token via AVNU swap |
| **Wall of Tips** | Live feed of supporters — name, message, amount, and Voyager link per tip |
| **Tip goals** | Creator sets a goal label + target amount; progress bar fills live |
| **Goal reached UX** | Goal card goes green with "tips still welcome" — form stays open, no hard cap |
| **On-chain proof** | Every supporter entry links to Voyager for transaction verification |
| **Mainnet** | Deployed and running on Starknet Mainnet |

---

## Starkzap SDK Integration

starkzappypay is built on three Starkzap modules:

### 1. Wallets
Privy handles social login. After authentication, the EVM embedded wallet signs a fixed derivation message. We use `ec.starkCurve.grindKey` to produce a deterministic Starknet private key — no seed phrase ever exposed.

```ts
const signature = await evmProvider.request({
  method: 'personal_sign',
  params: ['starkzappypay: authorize my Starknet wallet', address],
})
const starkPrivKey = ec.starkCurve.grindKey(signature)
const signer = new StarkSigner(starkPrivKey)
```

### 2. Paymaster
AVNU Paymaster is configured at SDK init. Every transaction is executed with `feeMode: "sponsored"` — users never need gas tokens.

```ts
const sdk = new StarkZap({
  network: 'mainnet',
  paymaster: {
    nodeUrl: 'https://starknet.paymaster.avnu.fi',
    headers: { 'x-paymaster-api-key': AVNU_API_KEY },
  },
})

const wallet = await sdk.connectWallet({
  account: { signer, accountClass: ArgentXV050Preset },
  feeMode: 'sponsored',
})
await wallet.ensureReady({ deploy: 'if_needed', feeMode: 'sponsored' })
```

### 3. Token Transfer
Direct ERC-20 transfer executed gaslessly when no swap is needed.

```ts
const tx = await wallet.execute([{
  contractAddress: token.address,
  entrypoint: 'transfer',
  calldata: CallData.compile({ recipient, amount: uint256.bnToUint256(amount) }),
}], { feeMode: 'sponsored' })
```

### 4. Token Swap via AVNU (v0.2.0)
When the tipper's selected token differs from the creator's preferred token, the flow runs as two sequential sponsored transactions to stay within AVNU paymaster simulation constraints.

**Step 1 — Swap:** fetch a fresh quote from AVNU v3, build calldata with `includeApprove: true`, execute approve + swap. USDC lands in the sender's wallet. Wait for confirmation.

**Step 2 — Transfer:** send the received USDC to the creator's address.

```ts
// Step 1: approve + swap (USDC → sender wallet)
const swapCalls = await buildSwapCalls(quote.quoteId, wallet.address)
const swapTx = await wallet.execute(swapCalls, { feeMode: 'sponsored' })
await provider.waitForTransaction(swapTx.hash)

// Step 2: transfer USDC to creator
const minReceived = (BigInt(quote.buyAmount) * BigInt(995)) / BigInt(1000)
await wallet.execute([{
  contractAddress: USDC_ADDRESS,
  entrypoint: 'transfer',
  calldata: CallData.compile({ recipient: creatorAddress, amount: uint256.bnToUint256(minReceived) }),
}], { feeMode: 'sponsored' })
```

---

## Supported Tokens

| Token | Decimals | Mainnet Address |
|-------|----------|----------------|
| STRK | 18 | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| USDC | 6 | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` |
| ETH | 18 | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |

---

## Important Notes

- The Starknet wallet address shown in the app is **derived from your Privy EVM signature** — it is a fresh address separate from your existing Argent or Braavos wallet
- Fund this address from your main Starknet wallet before tipping
- Usernames are stored in Supabase and resolve globally — any device, any browser
- The AVNU API key is included in the frontend bundle — for production, proxy paymaster requests through a backend endpoint
- Tip goal progress is calculated from the `tips` table using the creator's preferred token — tips logged after a swap correctly record the received token, not the sent token

---

## Built With

- [Starkzap SDK](https://starkzap.xyz) — wallet + paymaster + DeFi modules for Starknet
- [Privy](https://privy.io) — embedded wallets and social auth
- [AVNU](https://avnu.fi) — DEX aggregator (swap v3 API) and paymaster on Starknet
- [Supabase](https://supabase.com) — username → address storage and tips feed
- [starknet.js](https://starknetjs.com) — Starknet JavaScript library
- [Voyager](https://voyager.online) — Starknet block explorer (linked per tip)

---

## Changelog

### v0.2.0
- Wall of Tips — live supporter feed with names, messages, amounts
- Tip goals — creator-set targets with live progress bar
- Goal reached UX — green card, "tips still welcome" message, no hard cap
- Token auto-swap — AVNU v3 two-step sponsored swap flow
- On-chain proof — every supporter links to Voyager transaction
- Fixed USDC contract address to canonical Circle USDC on Starknet mainnet
- Fixed AVNU swap to use v3 API with correct `{ calls }` response shape

### v0.1.0
- Username links (`/pay/@username`)
- Social login via Privy (Email, Google, Apple, Twitter, Farcaster)
- Gasless STRK / USDC / ETH transfers via AVNU Paymaster
- Auto Argent account deploy on first use

---

## License

MIT — free to use, fork, and build on.

---

*Built for the [Starkzap Builder Program](https://docs.starknet.io/build/starkzap/overview) · Starknet Mainnet · March 2026*
