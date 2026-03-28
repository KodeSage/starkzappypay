import { useParams, Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { VOYAGER_TX_URL } from '../lib/sdk'

export default function Success() {
  const { txHash } = useParams<{ txHash: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? 'STRK'
  const amount = searchParams.get('amount') ?? ''

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
              Transaction confirmed on Starknet mainnet
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

        {/* CTA */}
        <div className="space-y-3">
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
