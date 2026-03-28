import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { RpcProvider, CallData, uint256, ec } from 'starknet'
import { StarkSigner, ArgentXV050Preset } from 'starkzap'
import Layout from '../components/Layout'
import { TOKENS, Token, parseAmount, formatAmount } from '../lib/tokens'
import { sdk, RPC_URL } from '../lib/sdk'
import { resolveUsername, type UsernameRecord } from '../lib/supabase'

// Derivation message — changing this would create a different Starknet key
const DERIVATION_MSG = 'starkzappypay: authorize my Starknet wallet'

function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 13) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-5)}`
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

type ConnectStep = 'idle' | 'privy-login' | 'deriving' | 'deploying'

type WalletState =
  | { status: 'idle' }
  | { status: 'connecting'; step: ConnectStep }
  | { status: 'connected'; szWallet: Awaited<ReturnType<typeof sdk.connectWallet>>; address: string }

export default function Pay() {
  const { identifier } = useParams<{ identifier: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useLocation() // keep router context fresh

  const isUsernameLink = identifier?.startsWith('@')
  const displayName = isUsernameLink ? identifier!.slice(1) : null

  // For raw address links, resolve immediately from params
  const [resolved, setResolved] = useState<UsernameRecord | null>(
    !isUsernameLink ? { username: '', address: identifier ?? '', message: searchParams.get('msg') ?? '' } : null
  )
  const [resolving, setResolving] = useState(isUsernameLink ?? false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!isUsernameLink || !displayName) return
    setResolving(true)
    resolveUsername(displayName).then((record) => {
      if (record) {
        setResolved(record)
      } else {
        setNotFound(true)
      }
      setResolving(false)
    })
  }, [isUsernameLink, displayName])

  const recipientAddress = resolved?.address ?? ''
  const tipMessage = resolved?.message ?? ''

  const { login, authenticated, ready, logout } = usePrivy()
  const { wallets } = useWallets()

  const [walletState, setWalletState] = useState<WalletState>({ status: 'idle' })
  const [selectedToken, setSelectedToken] = useState<Token>(TOKENS[0])
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const pendingConnectRef = useRef(false)
  const [addressCopied, setAddressCopied] = useState(false)

  // Detect OAuth redirect landing (Google/Twitter/Discord redirect back to this page)
  // Set pendingConnect so deriveAndConnect fires once Privy finishes processing the callback
  useEffect(() => {
    if (searchParams.has('privy_oauth_code') || searchParams.has('privy_oauth_state')) {
      pendingConnectRef.current = true
      setWalletState({ status: 'connecting', step: 'privy-login' })
      // Strip the OAuth params from the URL so the page looks clean
      navigate(window.location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fires after Privy login completes and wallets populate
  useEffect(() => {
    if (!pendingConnectRef.current) return
    if (!authenticated || !wallets.length) return
    if (walletState.status === 'connected') return
    // Already past login — don't re-trigger derivation
    if (walletState.status === 'connecting') {
      const { step } = walletState as Extract<WalletState, { status: 'connecting' }>
      if (step === 'deriving' || step === 'deploying') return
    }

    pendingConnectRef.current = false
    deriveAndConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, wallets.length])

  // Derive a stable address string to use as a proper effect dependency
  const connectedAddress = walletState.status === 'connected' ? walletState.address : null

  // Fetch balance whenever wallet address or selected token changes
  useEffect(() => {
    if (!connectedAddress) return

    setBalance(null)
    setLoadingBalance(true)
    const provider = new RpcProvider({ nodeUrl: RPC_URL })

    console.log('[balance] fetching for', connectedAddress, selectedToken.symbol)

    provider
      .callContract({
        contractAddress: selectedToken.address,
        entrypoint: 'balanceOf',
        calldata: [connectedAddress],
      }, 'latest')
      .catch((e) => {
        console.warn('[balance] balanceOf failed, trying balance_of:', e?.message)
        return provider.callContract({
          contractAddress: selectedToken.address,
          entrypoint: 'balance_of',
          calldata: [connectedAddress],
        }, 'latest')
      })
      .then((result) => {
        console.log('[balance] raw result:', result)
        const raw = Array.isArray(result) ? result : (result as { result: string[] }).result
        const low = BigInt(raw[0] ?? '0')
        const high = BigInt(raw[1] ?? '0')
        setBalance(low + high * BigInt(2 ** 128))
      })
      .catch((e) => {
        console.error('[balance] final error:', e?.message, e)
        setBalance(null)
      })
      .finally(() => setLoadingBalance(false))
  }, [connectedAddress, selectedToken.address])

  const deriveAndConnect = async () => {
    const evmWallet = wallets.find(
      (w) => w.walletClientType === 'privy'
    ) ?? wallets[0]

    if (!evmWallet) return

    setError('')
    setWalletState({ status: 'connecting', step: 'deriving' })

    try {
      // Step 1: Get EVM provider from Privy embedded wallet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = await (evmWallet as any).getEthereumProvider()

      // Step 2: Sign derivation message — embedded wallets sign silently (no popup)
      const signature: string = await provider.request({
        method: 'personal_sign',
        params: [DERIVATION_MSG, evmWallet.address],
      })

      // Step 3: Derive a valid Starknet private key from the EVM signature
      const starkPrivKey = ec.starkCurve.grindKey(signature)
      const signer = new StarkSigner(starkPrivKey)

      // Step 4: Connect Starkzap wallet (Argent account, AVNU-sponsored)
      setWalletState({ status: 'connecting', step: 'deploying' })
      const szWallet = await sdk.connectWallet({
        account: { signer, accountClass: ArgentXV050Preset },
        feeMode: 'sponsored',
      })
      await szWallet.ensureReady({ deploy: 'if_needed', feeMode: 'sponsored' })

      const address = szWallet.address
      setWalletState({ status: 'connected', szWallet, address })
    } catch (err) {
      setWalletState({ status: 'idle' })
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('reject')) {
        setError('Wallet setup failed — please try again')
        console.error(err)
      }
    }
  }

  const handleConnect = async () => {
    setError('')
    if (!authenticated) {
      // Not logged in: open Privy modal, then useEffect will call deriveAndConnect
      pendingConnectRef.current = true
      setWalletState({ status: 'connecting', step: 'privy-login' })
      await login()
    } else {
      // Already logged in: connect directly (Privy is fully initialized by this point)
      await deriveAndConnect()
    }
  }

  const copyAddress = async () => {
    const addr = walletState.status === 'connected' ? walletState.address : ''
    if (!addr) return
    await navigator.clipboard.writeText(addr)
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const handleDisconnect = () => {
    logout()
    setWalletState({ status: 'idle' })
    setBalance(null)
    setAmount('')
    setError('')
  }

  const sendTip = async () => {
    if (walletState.status !== 'connected' || !recipientAddress) return
    setError('')

    const parsedAmount = parseAmount(amount, selectedToken.decimals)
    if (parsedAmount === BigInt(0)) {
      setError('Enter an amount greater than 0')
      return
    }
    if (balance !== null && parsedAmount > balance) {
      setError('Insufficient balance')
      return
    }

    setSending(true)
    try {
      const { szWallet } = walletState
      const amountUint256 = uint256.bnToUint256(parsedAmount)
      const call = {
        contractAddress: selectedToken.address,
        entrypoint: 'transfer',
        calldata: CallData.compile({
          recipient: recipientAddress,
          amount: { low: amountUint256.low, high: amountUint256.high },
        }),
      }
      const tx = await szWallet.execute([call], { feeMode: 'sponsored' })
      navigate(
        `/success/${tx.hash}?token=${selectedToken.symbol}&amount=${encodeURIComponent(amount)}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        setError('Transaction cancelled')
      } else if (msg.toLowerCase().includes('insufficient')) {
        setError('Insufficient balance for this transaction')
      } else {
        setError('Transaction failed — please try again')
      }
    } finally {
      setSending(false)
    }
  }

  const connected = walletState.status === 'connected'
  const connecting = walletState.status === 'connecting'

  const connectLabel = () => {
    if (!connecting) return 'Connect & Tip'
    const step = (walletState as Extract<WalletState, { status: 'connecting' }>).step
    if (step === 'privy-login') return 'Signing in...'
    if (step === 'deriving') return 'Setting up wallet...'
    if (step === 'deploying') return 'Deploying account...'
    return 'Connecting...'
  }

  if (!ready || resolving) {
    return (
      <Layout>
        <div className="flex items-center gap-2 text-slate-500 mt-20">
          <Spinner />
          <span className="text-sm">{resolving ? 'Looking up username…' : 'Loading…'}</span>
        </div>
      </Layout>
    )
  }

  if (notFound) {
    return (
      <Layout>
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center space-y-3">
            <p className="text-4xl">🔍</p>
            <p className="text-white font-semibold text-lg">@{displayName} not found</p>
            <p className="text-slate-400 text-sm">
              This username hasn't been registered yet.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="w-full max-w-md space-y-4">

        {/* Recipient card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-700/10 border border-violet-500/30 flex items-center justify-center mx-auto text-3xl">
            ⚡
          </div>
          <div className="space-y-1">
            {displayName ? (
              <>
                <p className="text-white font-bold text-xl">@{displayName}</p>
                <p className="text-slate-500 text-xs font-mono">
                  {truncateAddress(recipientAddress)}
                </p>
              </>
            ) : (
              <p className="text-slate-400 text-xs font-mono">
                {truncateAddress(recipientAddress ?? '')}
              </p>
            )}
            {tipMessage && (
              <p className="text-white font-semibold text-lg mt-1.5">"{tipMessage}"</p>
            )}
          </div>
        </div>

        {/* Action card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">

          {!connected ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-white font-semibold">Send a tip</p>
                <p className="text-slate-400 text-sm">
                  {authenticated
                    ? 'Your account is ready — activate your Starknet wallet.'
                    : 'Sign in to tip — gas is on us.'}
                </p>
              </div>

              {/* Signed-in badge */}
              {authenticated && !connecting && (
                <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">Signed in via Privy</span>
                  <button
                    onClick={handleDisconnect}
                    className="ml-auto text-slate-600 hover:text-slate-400 text-xs transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3.5 transition-colors flex items-center justify-center gap-2"
              >
                {connecting
                  ? <><Spinner />{connectLabel()}</>
                  : authenticated
                    ? 'Activate Starknet Wallet'
                    : 'Connect & Tip'}
              </button>

              {!authenticated && (
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs">Google · Email · Apple · Twitter</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: '⛽', text: 'No gas fees' },
                  { icon: '🔑', text: 'No seed phrase' },
                  { icon: '⚡', text: 'Instant send' },
                ].map((f) => (
                  <div key={f.text} className="bg-slate-800/50 rounded-xl p-2.5 space-y-1">
                    <div className="text-lg">{f.icon}</div>
                    <div className="text-slate-400 text-xs">{f.text}</div>
                  </div>
                ))}
              </div>
            </div>

          ) : (
            <>
              {/* Wallet address card */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-400 text-xs font-medium">Wallet connected</span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Address display */}
                <div className="bg-slate-900 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-300 break-all leading-relaxed">
                  {(walletState as Extract<WalletState, {status:'connected'}>).address}
                </div>

                {/* Copy button */}
                <button
                  onClick={copyAddress}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all border ${
                    addressCopied
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                  }`}
                >
                  {addressCopied ? (
                    <>✓ Address copied!</>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy my wallet address
                    </>
                  )}
                </button>

                {/* Funding notice */}
                <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <span className="text-amber-400 flex-shrink-0 mt-0.5">ℹ</span>
                  <p className="text-amber-300/80 text-xs leading-relaxed">
                    <span className="font-semibold text-amber-300">Note:</span> This is your starkzappypay wallet address. To tip someone, send STRK, USDC, or ETH to this address from your main Starknet wallet first.
                  </p>
                </div>
              </div>

              {/* Token selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Token</label>
                <div className="grid grid-cols-3 gap-2">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => { setSelectedToken(token); setError(''); setAmount('') }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                        selectedToken.symbol === token.symbol
                          ? 'border-violet-500 bg-violet-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-lg font-semibold">{token.icon}</span>
                      <span className="text-xs font-medium">{token.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Amount</label>
                  <button
                    onClick={() => balance !== null && setAmount(formatAmount(balance, selectedToken.decimals))}
                    disabled={balance === null}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:text-slate-600 flex items-center gap-1"
                  >
                    {loadingBalance
                      ? <><Spinner />Loading...</>
                      : balance !== null
                        ? `Balance: ${formatAmount(balance, selectedToken.decimals)} ${selectedToken.symbol}`
                        : 'Balance unavailable'}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError('') }}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 text-xl font-semibold focus:border-violet-500 transition-colors pr-20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                    {selectedToken.symbol}
                  </span>
                </div>

                <div className="flex gap-2">
                  {['1', '5', '10', '25'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => { setAmount(preset); setError('') }}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors border ${
                        amount === preset
                          ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={sendTip}
                disabled={sending || !amount || Number(amount) <= 0}
                className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-colors flex items-center justify-center gap-2"
              >
                {sending
                  ? <><Spinner />Sending...</>
                  : `Send ${amount || '0'} ${selectedToken.symbol}`}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-slate-600 text-xs">
                <span>⛽</span>
                <span>Gas sponsored by AVNU Paymaster via Starkzap</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
