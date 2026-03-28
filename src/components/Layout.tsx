import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/logo.svg"
              alt="starkzappypay"
              className="w-7 h-7 rounded-lg"
            />
            <span className="text-white text-lg font-bold tracking-tight group-hover:text-violet-300 transition-colors">
              starkzappypay
            </span>
          </Link>
          <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
            Starknet Mainnet
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-6 py-4 text-center">
        <p className="text-slate-600 text-xs">
          Powered by{" "}
          <a
            href="https://docs.starknet.io/build/starkzap/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-500 hover:text-violet-400 transition-colors"
          >
            Starkzap SDK
          </a>{" "}
          · Gasless payments on Starknet
        </p>
      </footer>
    </div>
  );
}
