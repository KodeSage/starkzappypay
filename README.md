# starkzappypay ⚡

![Starknet Mainnet](https://img.shields.io/badge/Starknet-Mainnet-brightgreen?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNGRjQ3NTAiLz48L3N2Zz4=)
![Gasless](https://img.shields.io/badge/Gas%20Fees-Sponsored-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

> Gasless crypto tip links on Starknet. No wallet setup. No gas fees. Just a link.

**starkzappypay** lets anyone create a shareable payment link and receive STRK, USDC, or ETH from anyone , using only a social login (Google, email, Twitter). Built on Starknet using the [Starkzap SDK](https://docs.starknet.io/build/starkzap/overview).

---

## Live Demo

🔗 **[starkzappypay.vercel.app](https://starkzappypay.vercel.app)** *(update with your deployed URL)*

---

## How It Works

### For creators
1. Paste your Starknet address and an optional message
2. Get a shareable link — `/pay/0x...?msg=Buy+me+a+coffee`
3. Share it in your bio, Linktree, or anywhere

### For tippers
1. Open the creator's link
2. Sign in with Google, email, Apple, or Twitter — no seed phrase, no wallet extension
3. Pick a token (STRK, USDC, ETH), enter an amount, hit Send
4. Done , zero gas paid

---

## Features

| Feature | Details |
|---------|---------|
| **Gasless transactions** | AVNU Paymaster sponsors all fees , tippers never pay gas |
| **Social login** | Privy embedded wallet , email, Google, Apple, Twitter, Discord |
| **No seed phrase** | EVM embedded wallet derives a Starknet key via `grindKey` |
| **Auto account deploy** | Argent account deployed on first use, fee sponsored |
| **Multi-token** | STRK, USDC, ETH — tipper picks at send time |
| **Shareable links** | `/pay/:address?msg=...` — works anywhere |
| **Mainnet** | Deployed and running on Starknet mainnet |

---



## Starkzap SDK Integration

starkzappypay is built on three Starkzap modules:

### 1. Wallets
Privy handles social login. After authentication, the EVM embedded wallet signs a fixed derivation message. We use `ec.starkCurve.grindKey` to produce a deterministic Starknet private key , no seed phrase ever exposed.

```ts
const signature = await evmProvider.request({
  method: 'personal_sign',
  params: ['starkzappypay: authorize my Starknet wallet', address],
})
const starkPrivKey = ec.starkCurve.grindKey(signature)
const signer = new StarkSigner(starkPrivKey)
```

### 2. Paymaster
AVNU Paymaster is configured at SDK init. Every transaction is executed with `feeMode: "sponsored"` , users never need gas tokens.

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

### 3. DeFi — Token Transfer
ERC-20 transfer executed gaslessly through the connected wallet.

```ts
const tx = await wallet.execute([{
  contractAddress: token.address,
  entrypoint: 'transfer',
  calldata: CallData.compile({ recipient, amount: uint256.bnToUint256(amount) }),
}], { feeMode: 'sponsored' })

await tx.wait()
```

---

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_AVNU_API_KEY=your-avnu-paymaster-api-key
```


---

## Supported Tokens

| Token | Decimals | Mainnet Address |
|-------|----------|----------------|
| STRK | 18 | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| USDC | 6 | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a9` |
| ETH | 18 | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |

---

## Important Notes

- The Starknet wallet address shown in the app is **derived from your Privy EVM signature** , it is a fresh address separate from your existing Argent or Braavos wallet
- Fund this address from your main Starknet wallet before tipping
- The AVNU API key is currently included in the frontend bundle , for production, proxy paymaster requests through a backend endpoint

---

## Built With

- [Starkzap SDK](https://docs.starknet.io/build/starkzap/overview) — wallet + paymaster + DeFi modules for Starknet
- [Privy](https://privy.io) — embedded wallets and social auth
- [AVNU](https://avnu.fi) — DEX aggregator and paymaster on Starknet
- [starknet.js](https://starknetjs.com) — Starknet JavaScript library
- [Voyager](https://voyager.online) — Starknet block explorer

---

## License

MIT — free to use, fork, and build on.

---

*Built for the [Starkzap Bounty Program for Builders](https://docs.starknet.io/build/starkzap/overview) · Starknet Mainnet · April 2026*
