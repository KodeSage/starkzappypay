import { useState } from 'react'
import Layout from '../components/Layout'
import { saveUsername, validateUsernameAndAddress } from '../lib/supabase'

function isValidStarknetAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr.trim())
}

function isValidUsername(u: string): boolean {
  return /^[a-zA-Z0-9_]{1,30}$/.test(u)
}

export default function Home() {
  const [address, setAddress] = useState('')
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)

  const generateLink = async () => {
    const trimmedAddr = address.trim()
    const trimmedUser = username.trim().replace(/^@/, '')

    if (!trimmedAddr) {
      setError('Enter your Starknet address')
      return
    }
    if (!isValidStarknetAddress(trimmedAddr)) {
      setError('Invalid address — must start with 0x')
      return
    }
    if (!trimmedUser) {
      setError('Username is required')
      return
    }
    if (!isValidUsername(trimmedUser)) {
      setError('Username may only contain letters, numbers, and underscores (max 30 chars)')
      return
    }
    setError('')

    setSaving(true)

    const validation = await validateUsernameAndAddress(trimmedUser, trimmedAddr)
    if (!validation.ok) {
      setSaving(false)
      setError(validation.error)
      return
    }
    setIsUpdate(validation.isUpdate)

    const { error: saveError } = await saveUsername({
      username: trimmedUser,
      address: trimmedAddr,
      message: message.trim(),
    })
    setSaving(false)
    if (saveError) {
      setError(`Could not save: ${saveError}`)
      return
    }

    setLink(`${window.location.origin}/pay/@${trimmedUser}`)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout>
      <div className="w-full max-w-md space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Zero gas fees · Instant · No wallet setup
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Get tipped in crypto.
            <br />
            <span className="text-violet-400">No friction.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Generate a link. Share it anywhere. Your supporters send STRK, USDC,
            or ETH in seconds — signed in with Google, zero gas required.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/^@/, ""));
                  setError("");
                }}
                placeholder="alice"
                maxLength={30}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
              />
            </div>
            <p className="text-slate-600 text-xs">
              Creates a clean link like{" "}
              <span className="text-slate-500 font-mono">/pay/@{username}</span>
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Your Starknet address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setError("");
              }}
              placeholder="0x..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm font-mono focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">
              Message{" "}
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Buy me a coffee ☕"
              maxLength={60}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
            />
            <p className="text-slate-600 text-xs text-right">
              {message.length}/60
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={generateLink}
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {saving ? 'Checking…' : 'Generate tip link'}
          </button>
        </div>

        {/* Generated link */}
        {link && (
          <div className="bg-slate-900 rounded-2xl border border-violet-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-400">
                {isUpdate ? 'Link updated' : 'Your link is ready'}
              </span>
              {isUpdate && (
                <span className="ml-auto text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                  updated
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2.5">
              <span className="text-violet-300 text-sm font-semibold">
                @{username.trim().replace(/^@/, "")}
              </span>
              <span className="text-slate-500 text-xs ml-auto font-mono truncate">
                {address.slice(0, 10)}…{address.slice(-6)}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-xl px-4 py-3 text-slate-300 text-xs break-all font-mono leading-relaxed border border-slate-700/50">
              {link}
            </div>

            <button
              onClick={copyLink}
              className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-medium rounded-xl py-2.5 transition-colors text-sm border border-slate-700"
            >
              {copied ? "✓ Copied to clipboard" : "Copy link"}
            </button>

            <p className="text-slate-500 text-xs text-center">
              Share in your Twitter bio, Linktree, Discord, or anywhere
            </p>
          </div>
        )}

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              icon: "⛽",
              label: "Gas-free",
              desc: "AVNU Paymaster covers fees",
            },
            {
              icon: "🔐",
              label: "Seedless",
              desc: "Sign in with Email or Farcaster",
            },
            { icon: "⚡", label: "Instant", desc: "Confirmed in seconds" },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-slate-900 rounded-xl border border-slate-800 p-3 text-center space-y-1"
            >
              <div className="text-xl">{f.icon}</div>
              <div className="text-white text-xs font-semibold">{f.label}</div>
              <div className="text-slate-500 text-xs leading-tight">
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
