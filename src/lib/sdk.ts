import { StarkZap } from 'starkzap'

// NOTE: In production, proxy AVNU requests through your backend
// to keep the API key off the client. See Starkzap Paymasters docs.
export const sdk = new StarkZap({
  network: 'mainnet',
  paymaster: {
    nodeUrl: 'https://starknet.paymaster.avnu.fi',
    headers: {
      'x-paymaster-api-key': import.meta.env.VITE_AVNU_API_KEY as string,
    },
  },
})

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet'
export const VOYAGER_TX_URL = 'https://voyager.online/tx/'
