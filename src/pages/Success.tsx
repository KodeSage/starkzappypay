import { useParams, Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { VOYAGER_TX_URL } from '../lib/sdk'

export default function Success() {
  const { txHash } = useParams<{ txHash: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? 'STRK'
  const amount = searchParams.get('amount') ?? ''
  const recipient = searchParams.get('recipient') ?? ''

  const shortHash = txHash
    ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
    : ''

  return (
    <Layout>
      <div className="w-full max-w-md space-y-5">
        {/* Success card */}
        <div className="bg-slate-900 rounded-2xl border border-emerald-500/25 p-8 text-center space-y-5">
          {/* Checkmark */}
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <svg
                className="w-9 h-9 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">
              {amount ? `${amount} ${token} sent!` : "Tip sent!"}
            </h1>
            <p className="text-slate-400 text-sm">
              {recipient
                ? `You just supported @${recipient} on Starknet`
                : "Transaction confirmed on Starknet mainnet"}
            </p>
          </div>

          {/* Gas callout */}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 text-violet-300 text-sm">
            ⛽ You paid <strong>zero gas fees</strong> — sponsored by AVNU
            Paymaster
          </div>

          {/* Tx hash */}
          {txHash && (
            <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-left">
              <p className="text-slate-500 text-xs uppercase tracking-wider">
                Transaction
              </p>
              <p className="text-slate-300 text-xs font-mono break-all">
                {shortHash}
              </p>
              <a
                href={`${VOYAGER_TX_URL}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View on Voyager
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          {/* Auto-tweet share */}
          {recipient && (
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `Just supported @${recipient} on starkzappy pay ⚡\n\nZero gas fees, instant tips on @Starknet.\n\nTip them too → https://starkzappypay.vercel.app//pay/@${recipient}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#1d9bf0]/15 hover:bg-[#1d9bf0]/25 border border-[#1d9bf0]/30 text-[#1d9bf0] font-medium rounded-xl py-3 text-center transition-colors text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.857L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
              </svg>
              Share that you supported @{recipient}
            </a>
          )}

          {recipient && (
            <Link
              to={`/pay/@${recipient}`}
              className="block w-full bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl py-3 text-center transition-colors text-sm border border-slate-700"
            >
              Back to @{recipient}'s page
            </Link>
          )}
          <Link
            to="/"
            className="block w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3.5 text-center transition-colors"
          >
            Create your own tip link
          </Link>

          <p className="text-center text-slate-500 text-xs">
            Built with{" "}
            <a
              href="https://docs.starknet.io/build/starkzap/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              Starkzap SDK
            </a>{" "}
            · Open source on GitHub
          </p>
        </div>
      </div>
    </Layout>
  );
}
