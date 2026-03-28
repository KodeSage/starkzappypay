const AVNU_API = 'https://starknet.api.avnu.fi/swap/v3'

export interface SwapQuote {
  quoteId: string
  sellAmount: string   // hex string e.g. "0x..."
  buyAmount: string    // hex string
  buyAmountInUsd: number
  sellAmountInUsd: number
}

export interface SwapCall {
  contractAddress: string
  entrypoint: string
  calldata: string[]
}

/**
 * Fetch the best swap quote from AVNU for selling `sellAmount` of `sellTokenAddress`
 * to receive `buyTokenAddress`. Returns null if unavailable.
 */
export async function fetchSwapQuote(
  sellTokenAddress: string,
  buyTokenAddress: string,
  sellAmount: bigint,
  takerAddress: string
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      sellTokenAddress,
      buyTokenAddress,
      sellAmount: '0x' + sellAmount.toString(16),
      takerAddress,
      size: '1',
    })
    const res = await fetch(`${AVNU_API}/quotes?${params}`)
    if (!res.ok) {
      console.error('[avnu] quote failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const body = await res.json()
    const list: SwapQuote[] = Array.isArray(body) ? body : (body.quotes ?? [])
    return list[0] ?? null
  } catch {
    return null
  }
}

/**
 * Ask AVNU to build the swap calldata for a previously fetched quote.
 * `takerAddress` must be the wallet that will execute the swap (the sender).
 * Returns an array of calls (approve + swap) or null if unavailable.
 */
export async function buildSwapCalls(
  quoteId: string,
  takerAddress: string,
  slippage = 0.005
): Promise<SwapCall[] | null> {
  try {
    const res = await fetch(`${AVNU_API}/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, takerAddress, slippage, includeApprove: true }),
    })
    if (!res.ok) {
      console.error('[avnu] build failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const body = await res.json()
    const calls: SwapCall[] = body.calls ?? (Array.isArray(body) ? body : [body])
    return calls.length > 0 ? calls : null
  } catch {
    return null
  }
}
