import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import {
  saveUsername,
  validateUsernameAndAddress,
  resolveUsername,
  resolveAddress,
} from "../lib/supabase";
import { TOKENS } from "../lib/tokens";

function isValidStarknetAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr.trim());
}

function isValidUsername(u: string): boolean {
  return /^[a-zA-Z0-9_]{1,30}$/.test(u);
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [preferredToken, setPreferredToken] = useState("STRK");
  const [tokenExpanded, setTokenExpanded] = useState(false);
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkStatus, setLinkStatus] = useState<"new" | "updated" | "exists">(
    "new",
  );

  // Real-time lookup: check username as user types
  useEffect(() => {
    const trimmed = username.trim().replace(/^@/, "");
    if (!isValidUsername(trimmed)) {
      setLink("");
      return;
    }
    const timer = setTimeout(async () => {
      const record = await resolveUsername(trimmed);
      if (record) {
        setLinkStatus("exists");
        setLink(`${window.location.origin}/pay/@${record.username}`);
      } else {
        setLink("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  // Real-time lookup: check address as user types
  useEffect(() => {
    const trimmed = address.trim();
    if (!isValidStarknetAddress(trimmed)) {
      if (!username.trim()) setLink("");
      return;
    }
    const timer = setTimeout(async () => {
      const record = await resolveAddress(trimmed);
      if (record) {
        setLinkStatus("exists");
        setLink(`${window.location.origin}/pay/@${record.username}`);
      } else if (!username.trim()) {
        setLink("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [address, username]);

  const generateLink = async () => {
    const trimmedAddr = address.trim();
    const trimmedUser = username.trim().replace(/^@/, "");

    if (!trimmedAddr) {
      setError("Enter your Starknet address");
      return;
    }
    if (!isValidStarknetAddress(trimmedAddr)) {
      setError("Invalid address — must start with 0x");
      return;
    }
    if (!trimmedUser) {
      setError("Username is required");
      return;
    }
    if (!isValidUsername(trimmedUser)) {
      setError(
        "Username may only contain letters, numbers, and underscores (max 30 chars)",
      );
      return;
    }
    if (goalAmount && (isNaN(Number(goalAmount)) || Number(goalAmount) <= 0)) {
      setError("Goal amount must be a positive number");
      return;
    }
    setError("");
    setSaving(true);

    const validation = await validateUsernameAndAddress(
      trimmedUser,
      trimmedAddr,
    );

    if (!validation.ok) {
      setSaving(false);
      setLinkStatus("exists");
      setLink(`${window.location.origin}/pay/@${validation.existingUsername}`);
      return;
    }

    const { error: saveError } = await saveUsername({
      username: trimmedUser,
      address: trimmedAddr,
      message: message.trim(),
      preferred_token: preferredToken,
      goal_amount: goalAmount ? Number(goalAmount) : null,
      goal_label: goalLabel.trim(),
    });
    setSaving(false);
    if (saveError) {
      setError(`Could not save: ${saveError}`);
      return;
    }

    setLinkStatus(validation.isNew ? "new" : "updated");
    setLink(`${window.location.origin}/pay/@${trimmedUser}`);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <div className="w-full max-w-5xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 pt-2 max-w-xl mx-auto">
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
            or ETH in seconds — signed in with Email or Farcaster, zero gas
            required.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* Left — Form card */}
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
                <span className="text-slate-500 font-mono">
                  /pay/@{username || "you"}
                </span>
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

            {/* Preferred receive token */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setTokenExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2 group"
              >
                <div className="text-left">
                  <span className="text-sm font-medium text-slate-300">Preferred receive token</span>
                  {!tokenExpanded && (
                    <span className="ml-2 text-xs text-violet-400 font-medium">{preferredToken}</span>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 flex-shrink-0 ${tokenExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {tokenExpanded && (
                <>
                  <p className="text-slate-600 text-xs">
                    Supporters can send any token — we auto-swap it to this one for you
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {TOKENS.map((token) => (
                      <button
                        key={token.symbol}
                        type="button"
                        onClick={() => setPreferredToken(token.symbol)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                          preferredToken === token.symbol
                            ? "border-violet-500 bg-violet-500/10 text-white"
                            : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <span className="text-base">{token.icon}</span>
                        <span className="text-xs">{token.symbol}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tip goal (optional) */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setGoalExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2 group"
              >
                <div className="text-left">
                  <span className="text-sm font-medium text-slate-300">Tip goal</span>
                  <span className="text-slate-500 text-sm font-normal"> (optional)</span>
                  {!goalExpanded && goalAmount && (
                    <span className="ml-2 text-xs text-violet-400 font-medium">{goalAmount} {preferredToken}</span>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 flex-shrink-0 ${goalExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {goalExpanded && (
                <>
                  <p className="text-slate-600 text-xs">
                    Show supporters what you're saving for and track progress
                  </p>
                  <input
                    type="text"
                    value={goalLabel}
                    onChange={(e) => setGoalLabel(e.target.value)}
                    placeholder="New microphone"
                    maxLength={50}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={goalAmount}
                      onChange={(e) => {
                        setGoalAmount(e.target.value);
                        setError("");
                      }}
                      placeholder="100"
                      min="0"
                      step="any"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:border-violet-500 transition-colors"
                    />
                    <span className="text-slate-400 text-sm font-medium w-12 text-center">
                      {preferredToken}
                    </span>
                  </div>
                </>
              )}
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
              {saving ? "Checking…" : "Generate tip link"}
            </button>
          </div>

          {/* Right — Generated link + feature pills */}
          <div className="space-y-4">
            {/* Generated link */}
            {link ? (
              <div className="bg-slate-900 rounded-2xl border border-violet-500/30 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      linkStatus === "exists" ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      linkStatus === "exists"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {linkStatus === "exists"
                      ? "Link exists"
                      : linkStatus === "updated"
                        ? "Link updated"
                        : "Your link is ready"}
                  </span>
                  {linkStatus !== "new" && (
                    <span className="ml-auto text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                      {linkStatus}
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
            ) : (
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/60 border-dashed p-8 flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-2xl">🔗</p>
                <p className="text-slate-400 text-sm font-medium">Your link appears here</p>
                <p className="text-slate-600 text-xs">Fill in the form and hit Generate</p>
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

        </div>
      </div>
    </Layout>
  );
}
