import { notFound } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import { getGuideById, getGuidesByCategory, fetchGuideContent, GUIDES } from '@/lib/guides'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

interface Props {
  params: Promise<{ slug: string }>   // ← was { slug: string }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params        // ← await it
  const guide = getGuideById(slug)
  if (!guide) notFound()

  const content    = await fetchGuideContent(guide.s3Key)
  const related    = getGuidesByCategory(guide.category)
    .filter(g => g.id !== guide.id)
    .slice(0, 3)

  const categoryLabel = {
    members:   'Members',
    committee: 'Committee',
    webmaster: 'Webmaster',
  }[guide.category]

  const categoryColor = {
    members:   'bg-blue-50 text-blue-700',
    committee: 'bg-purple-50 text-purple-700',
    webmaster: 'bg-amber-50 text-amber-700',
  }[guide.category]

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/support" className="hover:text-gray-900 transition-colors">
          ← Help & Support
        </Link>
        <span>/</span>
        <span className="text-gray-900">{guide.title}</span>
      </nav>

      {/* Guide header */}
      <div className="card p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="text-4xl flex-shrink-0">{guide.icon}</span>
          <div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${categoryColor}`}>
              {categoryLabel}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{guide.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{guide.description}</p>
          </div>
        </div>

        {/* Markdown content */}
        <div className="prose prose-sm max-w-none
          prose-headings:font-semibold prose-headings:text-gray-900
          prose-h1:text-xl prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
          prose-p:text-gray-600 prose-p:leading-relaxed
          prose-li:text-gray-600 prose-li:leading-relaxed
          prose-strong:text-gray-900 prose-strong:font-semibold
          prose-a:font-medium prose-a:no-underline hover:prose-a:underline
          prose-table:text-sm
          prose-th:font-semibold prose-th:text-gray-700 prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2
          prose-td:px-4 prose-td:py-2 prose-td:text-gray-600 prose-td:border-gray-100
          prose-hr:border-gray-100 prose-hr:my-6
          prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        ">
          <MarkdownRenderer content={content} />
        </div>
      </div>

      {/* Still need help? */}
      <div className="card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900">Still need help?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Submit a support request and we'll get back to you within 1 business day.
          </p>
        </div>
        <Link
          href="/support#contact"
          className="btn-primary px-5 py-2.5 text-sm flex-shrink-0"
        >
          Contact Support →
        </Link>
      </div>

      {/* Related guides */}
      {related.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Related guides</h2>
          <div className="space-y-2">
            {related.map(g => (
              <Link
                key={g.id}
                href={`/support/${g.id}`}
                className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
              >
                <span className="text-xl">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:underline">
                    {g.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{g.description}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}