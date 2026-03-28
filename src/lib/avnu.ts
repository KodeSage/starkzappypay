const AVNU_SWAP_API = 'https://starknet.api.avnu.fi'

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
    const res = await fetch(`${AVNU_SWAP_API}/swap/v2/quotes?${params}`)
    if (!res.ok) return null
    const body = await res.json()
    const list: SwapQuote[] = Array.isArray(body) ? body : (body.quotes ?? [])
    return list[0] ?? null
  } catch {
    return null
  }
}

/**
 * Ask AVNU to build the swap calldata for a previously fetched quote.
 * Set `takerAddress` to the creator's address so bought tokens land there directly.
 * Returns null if the quote is stale or the API is unavailable.
 */
export async function buildSwapCall(
  quoteId: string,
  takerAddress: string,
  slippage = 0.005
): Promise<SwapCall | null> {
  try {
    const res = await fetch(`${AVNU_SWAP_API}/swap/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, takerAddress, slippage }),
    })
    if (!res.ok) return null
    return (await res.json()) as SwapCall
  } catch {
    return null
  }
}
