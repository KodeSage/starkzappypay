# starkzappypay — Launch Scripts

---

## Twitter Thread

**Tweet 1 (Hook)**
```
I built a gasless crypto tip link app on Starknet in under a week 🧵

Anyone can send STRK, USDC or ETH to a creator — no wallet setup, no gas fees, just a link.

Built with @starkzap SDK + Privy + AVNU Paymaster

Here's how it works 👇
```

---

**Tweet 2 (The Problem)**
```
Tipping in crypto is broken.

Your fans have to:
❌ Install a wallet
❌ Buy gas tokens
❌ Copy a long address
❌ Approve multiple steps

Most people give up before they even send $1.

starkzappypay fixes all of this.
```

---

**Tweet 3 (The Demo)**
```
Here's the flow:

1. Creator pastes their Starknet address → gets a shareable link
2. Fan opens the link
3. Logs in with Google or email (no seed phrase)
4. Picks STRK / USDC / ETH + amount → hits Send
5. Done. Zero gas paid.

The entire experience takes under 60 seconds.
```

---

**Tweet 4 (The Stack)**
```
What makes this possible 👇

⚡ @starkzap SDK — handles wallet setup + gasless tx
🔐 @privy_io — social login, EVM embedded wallet
🔗 Starknet key derived from EVM signature (grindKey)
⛽ AVNU Paymaster — sponsors all gas fees
🏗️ Argent account auto-deployed on first use

Web2 UX. Web3 rails.
```

---

**Tweet 5 (CTA)**
```
starkzappypay is live on Starknet mainnet 🚀

🔗 Try it: [YOUR_DEPLOYED_URL]
📦 GitHub: [YOUR_GITHUB_URL]

Built for the @Starknet x @starkzap Builder Program

If you're a creator, dev, or just curious — generate your tip link and share it.

#Starknet #Starkzap #BuildOnStarknet
```

---

---

## Video Script (2–3 min demo)

### [INTRO — 0:00–0:15]
*(Screen: starkzappypay homepage)*

**Voiceover / Talking head:**
> "What if tipping someone in crypto was as easy as sending a payment link?
> No wallet install. No gas fees. No seed phrases. Just a link.
> That's what I built — starkzappypay — using the Starkzap SDK on Starknet.
> Let me show you how it works."

---

### [CREATOR FLOW — 0:15–0:45]
*(Screen: Homepage — paste address, type message, generate link)*

**Voiceover:**
> "First, the creator side. You paste your Starknet address, add an optional message
> — something like 'Buy me a coffee' — and hit Generate.
> You get a shareable link instantly. Drop it in your Twitter bio, Linktree, anywhere."

*(Show the link being copied)*

> "That's it. No sign-up. No backend. Just a URL."

---

### [TIPPER FLOW — 0:45–1:30]
*(Screen: Open the /pay/ link)*

**Voiceover:**
> "Now the tipper opens the link. They see the creator's message and a Connect button.
> They click it — and get a Privy login modal."

*(Show Privy modal — Google / email options)*

> "They sign in with Google. No seed phrase. No wallet extension. Nothing to install.
> Under the hood, Privy creates an EVM embedded wallet, we derive a Starknet key from it,
> and deploy an Argent account — all in seconds."

*(Show wallet connected, balance loading)*

> "Their Starknet wallet is ready. They pick a token — STRK, USDC, or ETH —
> enter an amount, and hit Send."

*(Show the Send button, transaction submitting)*

> "The transaction goes through — gasless. The AVNU Paymaster covers the fee.
> The tipper paid zero gas. The creator gets the full amount."

*(Show success screen with Voyager link)*

---

### [TECHNICAL CALLOUT — 1:30–2:00]
*(Screen: Show code snippet or GitHub briefly)*

**Voiceover:**
> "The whole thing runs on the Starkzap SDK.
> Three lines to initialize with the AVNU paymaster.
> One call to connectWallet with a StarkSigner.
> One execute call with feeMode sponsored — and the transaction is gasless.
> No custom paymaster logic. No gas estimation. Starkzap handles it."

---

### [OUTRO — 2:00–2:20]
*(Screen: Back to homepage)*

**Voiceover:**
> "starkzappypay is live on Starknet mainnet, open source on GitHub.
> If you're a creator, generate your tip link right now.
> If you're a developer, fork it and build on top of it.
> Built with Starkzap. Deployed on Starknet."

*(End card with URL + GitHub + @starkzap tag)*

---

### Recording Tips
- Keep the real demo smooth — have your Privy account already set up so login is instant
- Fund the demo wallet with a small STRK amount before recording
- Record at 1080p, keep the browser zoom at 125% so UI is readable
- Trim any loading pauses in post — keep the pacing tight
- Add captions for Twitter (most people watch muted)
