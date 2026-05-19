import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://membersguild-backend:5015'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; filePath: string[] }> }
) {
  const { slug, filePath } = await params
  const filePathStr = filePath.join('/')

  const backendUrl = `${BACKEND_URL}/api/files/${slug}/${filePathStr}`

  const response = await fetch(backendUrl, {
    headers: { 'X-Club-Slug': slug },
    cache: 'no-store',
  })

  if (!response.ok) {
    return new NextResponse(null, { status: response.status })
  }

  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'
  const buffer = await response.arrayBuffer()   // ← binary safe, not text()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800',
    },
  })
}