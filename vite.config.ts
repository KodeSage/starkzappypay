import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const OPTIONAL_PEER_DEPS = [
  '@fatsolutions/tongo-sdk',
  '@solana/web3.js',
  '@hyperlane-xyz/sdk',
  '@hyperlane-xyz/registry',
  '@hyperlane-xyz/utils',
  '@cartridge/controller',
]

const stubPath = path.resolve(__dirname, 'src/stubs/empty.ts')

export default defineConfig({
  plugins: [
    // Polyfills Node built-ins (buffer, crypto, stream, etc.) for browser
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    react(),
  ],
  resolve: {
    alias: Object.fromEntries(
      OPTIONAL_PEER_DEPS.map((pkg) => [pkg, stubPath])
    ),
  },
})
