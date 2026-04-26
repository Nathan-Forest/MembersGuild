import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Docker multi-stage build — outputs a self-contained server.js
  output: 'standalone',

  // BACKEND_URL is the internal Docker service name — never exposed to browser
  // Set via docker-compose environment or .env.local for local dev
  env: {
    BACKEND_URL: process.env.BACKEND_URL ?? 'http://membersguild-backend:5015',
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.membersguild.com.au',
      },
      {
        // Local dev — profile photos and logos
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  // Required for PWA — service worker needs to be at root
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ]
  },
}

export default nextConfig
