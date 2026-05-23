'use client'
import { useState, useEffect } from 'react'

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  const [html, setHtml] = useState<React.ReactNode | null>(null)

  useEffect(() => {
    Promise.all([
      import('react-markdown'),
      import('remark-gfm'),
    ]).then(([{ default: ReactMarkdown }, { default: remarkGfm }]) => {
      setHtml(
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      )
    })
  }, [content])

  if (!html) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3,4].map(i => (
        <div key={i} className={`h-4 bg-gray-100 rounded ${i === 4 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )

  return <div className={className}>{html}</div>
}