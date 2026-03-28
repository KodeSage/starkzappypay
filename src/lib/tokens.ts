export interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  icon: string
}

export const TOKENS: Token[] = [
  {
    symbol: "STRK",
    name: "Starknet Token",
    address:
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    decimals: 18,
    icon: "⚡",
  },
  {
    symbol: "USDC",
    name: "USDC Token",
    address:
      "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    decimals: 6,
    icon: "$",
  },
  {
    symbol: "ETH",
    name: "Ether",
    address:
      "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7",
    decimals: 18,
    icon: "Ξ",
  },
];

export function parseAmount(amount: string, decimals: number): bigint {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return BigInt(0)
  const [integer, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(integer || '0') * BigInt(10 ** decimals) + BigInt(paddedFraction || '0')
}

export function formatAmount(raw: bigint, decimals: number, maxDecimals = 6): string {
  const divisor = BigInt(10 ** decimals)
  const integer = raw / divisor
  const fraction = raw % divisor
  if (fraction === BigInt(0)) return integer.toString()
  const fractionStr = fraction
    .toString()
    .padStart(decimals, '0')
    .slice(0, maxDecimals)
    .replace(/0+$/, '')
  return `${integer}.${fractionStr}`
}
