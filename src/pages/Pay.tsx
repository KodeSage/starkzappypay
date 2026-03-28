import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { RpcProvider, CallData, uint256, ec } from 'starknet'
import { StarkSigner, ArgentXV050Preset } from 'starkzap'
import Layout from '../components/Layout'
import { TOKENS, Token, parseAmount, formatAmount } from '../lib/tokens'
import { sdk, RPC_URL } from '../lib/sdk'
import { resolveUsername, type UsernameRecord, logTip, getTips, type TipRecord, getGoalProgress } from '../lib/supabase'
import { fetchSwapQuote, buildSwapCalls, type SwapQuote } from '../lib/avnu'

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
  useLocation()

  const isUsernameLink = identifier?.startsWith('@')
  const displayName = isUsernameLink ? identifier!.slice(1) : null

  const [resolved, setResolved] = useState<UsernameRecord | null>(
    !isUsernameLink
      ? { username: '', address: identifier ?? '', message: searchParams.get('msg') ?? '' }
      : null
  )
  const [resolving, setResolving] = useState(isUsernameLink ?? false)
  const [notFound, setNotFound] = useState(false)

  // Wall of tips state
  const [tips, setTips] = useState<TipRecord[]>([])
  const [goalProgress, setGoalProgress] = useState(0)
  const [tipsPage, setTipsPage] = useState(0)
  const TIPS_PER_PAGE = 6

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

  // Load tips and goal progress once resolved
  useEffect(() => {
    if (!displayName || !resolved) return
    getTips(displayName).then(setTips)
    if (resolved.goal_amount && resolved.preferred_token) {
      getGoalProgress(displayName, resolved.preferred_token).then(setGoalProgress)
    }
  }, [displayName, resolved?.username])

  const recipientAddress = resolved?.address ?? ''
  const tipMessage = resolved?.message ?? ''
  const preferredTokenSymbol = resolved?.preferred_token ?? 'STRK'
  const preferredTokenObj = TOKENS.find((t) => t.symbol === preferredTokenSymbol) ?? TOKENS[0]

  const { login, authenticated, ready, logout } = usePrivy()
  const { wallets } = useWallets()

  const [walletState, setWalletState] = useState<WalletState>({ status: 'idle' })
  const [selectedToken, setSelectedToken] = useState<Token>(TOKENS[0])
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [sending, setSending] = useState(false)
  const [swapStep, setSwapStep] = useState<'swapping' | 'sending' | null>(null)
  const [error, setError] = useState('')
  const [swapGasError, setSwapGasError] = useState(false)

  // Tipper identity for wall of tips
  const [tipperName, setTipperName] = useState('')
  const [tipperMessage, setTipperMessage] = useState('')
  const [tipperExpanded, setTipperExpanded] = useState(false)

  // Swap quote state
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null)
  const [fetchingQuote, setFetchingQuote] = useState(false)

  const pendingConnectRef = useRef(false)
  const [addressCopied, setAddressCopied] = useState(false)

  const needsSwap = !!(
    resolved?.preferred_token &&
    selectedToken.symbol !== preferredTokenSymbol &&
    swapQuote
  )

  // Detect OAuth redirect
  useEffect(() => {
    if (searchParams.has('privy_oauth_code') || searchParams.has('privy_oauth_state')) {
      pendingConnectRef.current = true
      setWalletState({ status: 'connecting', step: 'privy-login' })
      navigate(window.location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!pendingConnectRef.current) return
    if (!authenticated || !wallets.length) return
    if (walletState.status === 'connected') return
    if (walletState.status === 'connecting') {
      const { step } = walletState as Extract<WalletState, { status: 'connecting' }>
      if (step === 'deriving' || step === 'deploying') return
    }
    pendingConnectRef.current = false
    deriveAndConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, wallets.length])

  const connectedAddress = walletState.status === 'connected' ? walletState.address : null

  // Fetch balance when wallet/token changes
  useEffect(() => {
    if (!connectedAddress) return
    setBalance(null)
    setLoadingBalance(true)
    const provider = new RpcProvider({ nodeUrl: RPC_URL })

    provider
      .callContract(
        { contractAddress: selectedToken.address, entrypoint: 'balanceOf', calldata: [connectedAddress] },
        'latest'
      )
      .catch(() =>
        provider.callContract(
          { contractAddress: selectedToken.address, entrypoint: 'balance_of', calldata: [connectedAddress] },
          'latest'
        )
      )
      .then((result) => {
        const raw = Array.isArray(result) ? result : (result as { result: string[] }).result
        const low = BigInt(raw[0] ?? '0')
        const high = BigInt(raw[1] ?? '0')
        setBalance(low + high * BigInt(2 ** 128))
      })
      .catch(() => setBalance(null))
      .finally(() => setLoadingBalance(false))
  }, [connectedAddress, selectedToken.address])

  // Fetch swap quote when amount/token changes (debounced)
  useEffect(() => {
    setSwapQuote(null)
    if (!connectedAddress || !resolved?.preferred_token) return
    if (selectedToken.symbol === preferredTokenSymbol) return
    if (!amount || Number(amount) <= 0) return

    const timer = setTimeout(async () => {
      setFetchingQuote(true)
      const parsedAmt = parseAmount(amount, selectedToken.decimals)
      const quote = await fetchSwapQuote(
        selectedToken.address,
        preferredTokenObj.address,
        parsedAmt,
        connectedAddress
      )
      setSwapQuote(quote)
      setFetchingQuote(false)
    }, 600)

    return () => {
      clearTimeout(timer)
      setFetchingQuote(false)
    }
  }, [connectedAddress, amount, selectedToken.symbol, preferredTokenSymbol])

  const deriveAndConnect = async () => {
    const evmWallet = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0]
    if (!evmWallet) return

    setError('')
    setWalletState({ status: 'connecting', step: 'deriving' })

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = await (evmWallet as any).getEthereumProvider()
      const signature: string = await provider.request({
        method: 'personal_sign',
        params: [DERIVATION_MSG, evmWallet.address],
      })
      const starkPrivKey = ec.starkCurve.grindKey(signature)
      const signer = new StarkSigner(starkPrivKey)

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
      pendingConnectRef.current = true
      setWalletState({ status: 'connecting', step: 'privy-login' })
      await login()
    } else {
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
    setSwapQuote(null)
  }

  const sendTip = async (skipSwap = false) => {
    if (walletState.status !== 'connected' || !recipientAddress) return
    setError('')
    setSwapGasError(false)

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

      const wantsSwap = !skipSwap && resolved?.preferred_token && selectedToken.symbol !== preferredTokenSymbol

      if (wantsSwap) {
        // --- Two-step swap flow ---
        // The AVNU paymaster can't simulate a swap + transfer in one tx,
        // so we execute them separately: swap first, then transfer USDC to creator.

        const freshQuote = await fetchSwapQuote(
          selectedToken.address,
          preferredTokenObj.address,
          parsedAmount,
          walletState.address
        )

        if (!freshQuote) {
          setError(`Swap to ${preferredTokenSymbol} is currently unavailable. Please try again.`)
          return
        }

        const swapCalls = await buildSwapCalls(freshQuote.quoteId, walletState.address)

        if (!swapCalls) {
          setError(`Swap to ${preferredTokenSymbol} is currently unavailable. Please try again.`)
          return
        }

        const minReceived = (BigInt(freshQuote.buyAmount) * BigInt(995)) / BigInt(1000)
        const logToken = preferredTokenSymbol
        const logAmount = formatAmount(minReceived, preferredTokenObj.decimals)

        // Step 1: Execute approve + swap — target token lands in sender's wallet.
        // AVNU's paymaster internally caps sponsored tx at 1.2B L2 gas. Complex
        // multi-route swaps can exceed this limit. When that happens we surface a
        // clear error and let the user decide — offering a direct-send fallback.
        setSwapStep('swapping')
        let swapTxHash: string
        try {
          const swapTx = await szWallet.execute(swapCalls, { feeMode: 'sponsored' })
          swapTxHash = swapTx.hash
        } catch (sponsoredErr) {
          const sponsoredMsg = (sponsoredErr instanceof Error ? sponsoredErr.message : String(sponsoredErr)).toLowerCase()
          if (
            sponsoredMsg.includes('gas amount') ||
            sponsoredMsg.includes('max gas') ||
            sponsoredMsg.includes('resources bounds') ||
            sponsoredMsg.includes('resource bounds')
          ) {
            setSending(false)
            setSwapStep(null)
            setSwapGasError(true)
            setError(
              `Gasless swap unavailable right now — the route for ${selectedToken.symbol}→${preferredTokenSymbol} requires too much network gas for the paymaster. You can send ${amount} ${selectedToken.symbol} directly instead (tap "Send directly" below).`
            )
            return
          }
          throw sponsoredErr
        }

        // Wait for the swap to confirm so the sender actually holds USDC
        const rpcProvider = new RpcProvider({ nodeUrl: RPC_URL })
        await rpcProvider.waitForTransaction(swapTxHash, { retryInterval: 2000 })

        // Step 2: Transfer USDC from sender to creator
        setSwapStep('sending')
        const transferTx = await szWallet.execute(
          [
            {
              contractAddress: preferredTokenObj.address,
              entrypoint: 'transfer',
              calldata: CallData.compile({
                recipient: recipientAddress,
                amount: uint256.bnToUint256(minReceived),
              }),
            },
          ],
          { feeMode: 'sponsored' }
        )

        if (displayName) {
          logTip({
            recipient_username: displayName,
            tipper_name: tipperName.trim(),
            tipper_message: tipperMessage.trim(),
            amount: logAmount,
            token: logToken,
            tx_hash: transferTx.hash,
          }).catch(console.error)
        }

        navigate(
          `/success/${transferTx.hash}?token=${encodeURIComponent(logToken)}&amount=${encodeURIComponent(logAmount)}&recipient=${encodeURIComponent(displayName ?? '')}`
        )
        return
      }

      // --- Direct transfer (no swap needed) ---
      const tx = await szWallet.execute(
        [
          {
            contractAddress: selectedToken.address,
            entrypoint: 'transfer',
            calldata: CallData.compile({
              recipient: recipientAddress,
              amount: { low: amountUint256.low, high: amountUint256.high },
            }),
          },
        ],
        { feeMode: 'sponsored' }
      )

      if (displayName) {
        logTip({
          recipient_username: displayName,
          tipper_name: tipperName.trim(),
          tipper_message: tipperMessage.trim(),
          amount,
          token: selectedToken.symbol,
          tx_hash: tx.hash,
        }).catch(console.error)
      }

      navigate(
        `/success/${tx.hash}?token=${encodeURIComponent(selectedToken.symbol)}&amount=${encodeURIComponent(amount)}&recipient=${encodeURIComponent(displayName ?? '')}`
      )
    } catch (err) {
      console.error('[sendTip] failed:', err)
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
      setSwapStep(null)
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

  const showSwapBadge =
    connected &&
    resolved?.preferred_token &&
    selectedToken.symbol !== preferredTokenSymbol &&
    !!amount &&
    Number(amount) > 0

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
            <p className="text-slate-400 text-sm">This username hasn't been registered yet.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const goalPct = resolved?.goal_amount
    ? Math.min((goalProgress / resolved.goal_amount) * 100, 100)
    : 0

  return (
    <Layout>
      <div className="w-full max-w-5xl space-y-4">

        {/* Recipient card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-700/10 border border-violet-500/30 flex items-center justify-center mx-auto text-3xl">
            ⚡
          </div>
          <div className="space-y-1">
            {displayName ? (
              <>
                <p className="text-white font-bold text-xl">@{displayName}</p>
                <p className="text-slate-500 text-xs font-mono">{truncateAddress(recipientAddress)}</p>
              </>
            ) : (
              <p className="text-slate-400 text-xs font-mono">{truncateAddress(recipientAddress ?? '')}</p>
            )}
            {tipMessage && (
              <p className="text-white font-semibold text-lg mt-1.5">"{tipMessage}"</p>
            )}
          </div>
        </div>

        {/* Tip goal progress bar */}
        {resolved?.goal_amount && resolved.goal_amount > 0 && (
          <div className={`rounded-2xl border p-5 space-y-3 ${
            goalPct >= 100
              ? 'bg-emerald-950/40 border-emerald-700/40'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  {goalPct >= 100 && <span className="text-emerald-400 text-sm">✓</span>}
                  <p className="text-white text-sm font-semibold">
                    {resolved.goal_label || 'Tip goal'}
                  </p>
                </div>
                <p className={`text-xs mt-0.5 ${goalPct >= 100 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {goalPct >= 100 ? 'Goal reached — tips still welcome!' : `${Math.round(goalPct)}% funded`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${goalPct >= 100 ? 'text-emerald-400' : 'text-violet-400'}`}>
                  {goalProgress.toFixed(goalProgress % 1 === 0 ? 0 : 2)}
                </p>
                <p className="text-slate-500 text-xs">
                  of {resolved.goal_amount} {preferredTokenSymbol}
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${goalPct}%`,
                  background: goalPct >= 100
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />
            </div>
          </div>
        )}

        {/* Action card + Wall of Tips side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

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

                <div className="bg-slate-900 rounded-lg px-3 py-2.5 font-mono text-xs text-slate-300 break-all leading-relaxed">
                  {(walletState as Extract<WalletState, { status: 'connected' }>).address}
                </div>

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

                <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <span className="text-amber-400 flex-shrink-0 mt-0.5">ℹ</span>
                  <p className="text-amber-300/80 text-xs leading-relaxed">
                    <span className="font-semibold text-amber-300">Note:</span> This is your starkzappypay wallet. Send STRK, USDC, or ETH here from your main wallet first.
                  </p>
                </div>
              </div>

              {/* Token selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Token</label>
                  {resolved?.preferred_token && (
                    <span className="text-xs text-slate-500">
                      Creator prefers{' '}
                      <span className="text-violet-400 font-medium">{preferredTokenSymbol}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => { setSelectedToken(token); setError(''); setAmount(''); setSwapQuote(null) }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                        selectedToken.symbol === token.symbol
                          ? 'border-violet-500 bg-violet-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-lg font-semibold">{token.icon}</span>
                      <span className="text-xs font-medium">{token.symbol}</span>
                      {token.symbol === preferredTokenSymbol && (
                        <span className="text-[10px] text-violet-400 font-medium -mt-0.5">preferred</span>
                      )}
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

              {/* Auto-swap preview */}
              {showSwapBadge && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-violet-300 text-xs font-semibold uppercase tracking-wide">Auto-swap</p>
                  {fetchingQuote ? (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Spinner />
                      <span>Getting quote…</span>
                    </div>
                  ) : swapQuote ? (
                    <p className="text-slate-200 text-sm">
                      You send{' '}
                      <span className="font-semibold">{amount} {selectedToken.symbol}</span>
                      {' → '}creator receives{' '}
                      <span className="font-semibold text-violet-300">
                        ~{formatAmount(BigInt(swapQuote.buyAmount), preferredTokenObj.decimals)} {preferredTokenSymbol}
                      </span>
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs">
                      Quote unavailable — will send {selectedToken.symbol} directly
                    </p>
                  )}
                </div>
              )}

              {/* Tipper identity — collapsible */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setTipperExpanded((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 group"
                >
                  <div className="text-left">
                    <span className="text-sm font-medium text-slate-300">Add your name &amp; message</span>
                    <span className="text-slate-500 text-sm font-normal"> (optional)</span>
                    {!tipperExpanded && (tipperName || tipperMessage) && (
                      <span className="ml-2 text-xs text-violet-400 font-medium truncate max-w-[120px] inline-block align-bottom">
                        {tipperName || tipperMessage}
                      </span>
                    )}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 flex-shrink-0 ${tipperExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {tipperExpanded && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Your name{' '}
                        <span className="text-slate-500 font-normal">(shows on wall of tips)</span>
                      </label>
                      <input
                        type="text"
                        value={tipperName}
                        onChange={(e) => setTipperName(e.target.value)}
                        placeholder="anonymous"
                        maxLength={30}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Message
                      </label>
                      <input
                        type="text"
                        value={tipperMessage}
                        onChange={(e) => setTipperMessage(e.target.value)}
                        placeholder="Keep up the great work!"
                        maxLength={100}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {swapGasError && (
                <button
                  onClick={() => {
                    setSwapGasError(false)
                    setError('')
                    // Execute direct transfer of selected token, bypassing swap
                    sendTip(true)
                  }}
                  disabled={sending || !amount || Number(amount) <= 0}
                  className="w-full bg-slate-700 hover:bg-slate-600 active:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 transition-colors text-sm border border-slate-600"
                >
                  Send {amount || '0'} {selectedToken.symbol} directly (skip swap)
                </button>
              )}

              <button
                onClick={() => sendTip(false)}
                disabled={sending || !amount || Number(amount) <= 0}
                className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-colors flex items-center justify-center gap-2"
              >
                {sending && swapStep === 'swapping'
                  ? <><Spinner />Swapping tokens…</>
                  : sending && swapStep === 'sending'
                  ? <><Spinner />Sending to creator…</>
                  : sending
                  ? <><Spinner />Sending…</>
                  : needsSwap
                  ? `Swap & send ${amount || '0'} ${selectedToken.symbol} → ${preferredTokenSymbol}`
                  : `Send ${amount || '0'} ${selectedToken.symbol}`}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-slate-600 text-xs">
                <span>⛽</span>
                <span>Gas sponsored by AVNU Paymaster via Starkzap</span>
              </div>
            </>
          )}
        </div>

        {/* Wall of Tips */}
        {tips.length > 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Recent supporters</h3>
              <span className="text-slate-500 text-xs">{tips.length} tip{tips.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {tips.slice(tipsPage * TIPS_PER_PAGE, (tipsPage + 1) * TIPS_PER_PAGE).map((tip, i) => (
                <a
                  key={tip.id ?? i}
                  href={tip.tx_hash ? `https://voyager.online/tx/${tip.tx_hash}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-3 rounded-xl p-2 -mx-2 transition-colors ${
                    tip.tx_hash ? 'hover:bg-slate-800/60 cursor-pointer group' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0 uppercase">
                    {tip.tipper_name ? tip.tipper_name.slice(0, 1) : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-white text-sm font-medium truncate">
                          {tip.tipper_name || 'Anonymous'}
                        </span>
                        {tip.tx_hash && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-600 group-hover:text-violet-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </div>
                      <span className="text-violet-400 text-xs font-semibold flex-shrink-0">
                        {tip.amount} {tip.token}
                      </span>
                    </div>
                    {tip.tipper_message && (
                      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed line-clamp-2">
                        "{tip.tipper_message}"
                      </p>
                    )}
                    {tip.tx_hash && (
                      <p className="text-slate-600 group-hover:text-slate-500 text-[10px] mt-0.5 font-mono transition-colors">
                        {tip.tx_hash.slice(0, 10)}…{tip.tx_hash.slice(-6)}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
            {tips.length > TIPS_PER_PAGE && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <button
                  onClick={() => setTipsPage((p) => Math.max(0, p - 1))}
                  disabled={tipsPage === 0}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                <span className="text-slate-600 text-xs">
                  {tipsPage + 1} / {Math.ceil(tips.length / TIPS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setTipsPage((p) => Math.min(Math.ceil(tips.length / TIPS_PER_PAGE) - 1, p + 1))}
                  disabled={(tipsPage + 1) * TIPS_PER_PAGE >= tips.length}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        </div>{/* end side-by-side grid */}

      </div>
    </Layout>
  )
}
