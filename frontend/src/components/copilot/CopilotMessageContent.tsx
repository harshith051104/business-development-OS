import React from 'react'

interface CopilotMessageContentProps {
  content: string
  isUser?: boolean
}

// Stage color definitions matching ELLY CRM Connection Pipeline
const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Potential: { bg: 'bg-slate-800', text: 'text-slate-200', border: 'border-slate-600/70' },
  Contacted: { bg: 'bg-blue-950/90', text: 'text-blue-300', border: 'border-blue-700/60' },
  Connected: { bg: 'bg-indigo-950/90', text: 'text-indigo-300', border: 'border-indigo-700/60' },
  Interested: { bg: 'bg-amber-950/90', text: 'text-amber-300', border: 'border-amber-700/60' },
  Meeting: { bg: 'bg-purple-950/90', text: 'text-purple-300', border: 'border-purple-700/60' },
  Discussion: { bg: 'bg-cyan-950/90', text: 'text-cyan-300', border: 'border-cyan-700/60' },
  Partnership: { bg: 'bg-emerald-950/90', text: 'text-emerald-300', border: 'border-emerald-700/60' },
}

// Sequential, robust markdown tokenizer
const formatInlineText = (rawText: string): React.ReactNode[] => {
  if (!rawText) return []

  // Clean any accidental nested backtick artifacts like **`Word`** -> **Word**
  const text = rawText
    .replace(/\*\*\`([^*`]+)\`\*\*/g, '**$1**')
    .replace(/\`\*\*([^*`]+)\*\*\`/g, '**$1**')

  const elements: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    // 1. Priority tags [HIGH], [MEDIUM], [LOW]
    const prioMatch = remaining.match(/^(\[(HIGH|MEDIUM|LOW)\])/)
    if (prioMatch) {
      const p = prioMatch[2]
      const colorClass =
        p === 'HIGH'
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          : p === 'MEDIUM'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'

      elements.push(
        <span
          key={`prio-${keyIndex++}`}
          className={`inline-flex items-center px-1.5 py-0.5 mx-1 rounded text-[10px] font-bold tracking-wider uppercase border ${colorClass}`}
        >
          {p === 'MEDIUM' ? 'MED' : p}
        </span>
      )
      remaining = remaining.slice(prioMatch[0].length)
      continue
    }

    // 2. Decision Maker badge
    const dmMatch = remaining.match(/^(⭐\s*\(Decision Maker\))/)
    if (dmMatch) {
      elements.push(
        <span
          key={`dm-${keyIndex++}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded text-[10px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30"
        >
          ⭐ Decision Maker
        </span>
      )
      remaining = remaining.slice(dmMatch[0].length)
      continue
    }

    // 3. Bold text **...**
    const boldMatch = remaining.match(/^(\*\*([^*]+)\*\*)/)
    if (boldMatch) {
      const inner = boldMatch[2].trim().replace(/^`|`$/g, '')
      const stageStyle = STAGE_STYLES[inner]

      if (stageStyle) {
        elements.push(
          <span
            key={`stage-${keyIndex++}`}
            className={`inline-flex items-center px-2 py-0.5 mr-1 rounded-md text-[11px] font-bold tracking-wide border shadow-xs ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
          >
            {inner}
          </span>
        )
      } else {
        elements.push(
          <strong key={`bold-${keyIndex++}`} className="font-semibold text-slate-100">
            {inner}
          </strong>
        )
      }
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // 4. Code chips `...`
    const codeMatch = remaining.match(/^(`([^`]+)`)/)
    if (codeMatch) {
      const inner = codeMatch[2].trim()
      const stageStyle = STAGE_STYLES[inner]

      if (stageStyle) {
        elements.push(
          <span
            key={`stage-${keyIndex++}`}
            className={`inline-flex items-center px-2 py-0.5 mr-1 rounded-md text-[11px] font-bold tracking-wide border shadow-xs ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
          >
            {inner}
          </span>
        )
      } else {
        elements.push(
          <code
            key={`code-${keyIndex++}`}
            className="px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono bg-slate-900/90 text-teal-300 border border-slate-700/80 shadow-xs"
          >
            {inner}
          </code>
        )
      }
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // 5. Italic text *...*
    const italicMatch = remaining.match(/^(\*([^*]+)\*)/)
    if (italicMatch) {
      elements.push(
        <em key={`italic-${keyIndex++}`} className="italic text-slate-400 text-[12px]">
          {italicMatch[2]}
        </em>
      )
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // 6. Plain text until next markdown trigger
    const nextSpecial = remaining.search(/(\[HIGH\]|\[MEDIUM\]|\[LOW\]|\*\*|`|⭐|\*)/)
    if (nextSpecial === -1) {
      elements.push(<span key={`text-${keyIndex++}`}>{remaining}</span>)
      break
    } else if (nextSpecial === 0) {
      // Unmatched lone character
      elements.push(<span key={`text-${keyIndex++}`}>{remaining[0]}</span>)
      remaining = remaining.slice(1)
    } else {
      elements.push(<span key={`text-${keyIndex++}`}>{remaining.slice(0, nextSpecial)}</span>)
      remaining = remaining.slice(nextSpecial)
    }
  }

  return elements
}

export const CopilotMessageContent: React.FC<CopilotMessageContentProps> = ({
  content,
  isUser = false,
}) => {
  if (isUser) {
    return <div className="text-[13px] leading-relaxed break-words font-medium">{content}</div>
  }

  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []

  let currentBullets: string[] = []
  let currentNumbered: string[] = []

  const flushBullets = (key: string) => {
    if (currentBullets.length > 0) {
      const items = [...currentBullets]
      currentBullets = []
      blocks.push(
        <div
          key={key}
          className="my-2.5 space-y-1.5 bg-slate-900/50 rounded-xl p-3 border border-slate-800/80"
        >
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-200 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0 shadow-xs shadow-teal-400/50"></span>
              <div className="flex-1">{formatInlineText(item)}</div>
            </div>
          ))}
        </div>
      )
    }
  }

  const flushNumbered = (key: string) => {
    if (currentNumbered.length > 0) {
      const items = [...currentNumbered]
      currentNumbered = []
      blocks.push(
        <div key={key} className="my-2.5 space-y-2">
          {items.map((item, i) => {
            const parts = item.split(/\s*—\s*/)
            const mainPart = parts[0]
            const subPart = parts.slice(1).join(' — ')

            return (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 shadow-sm hover:border-teal-500/40 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 font-bold text-[11px] shrink-0 border border-teal-500/30 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 text-[12.5px] leading-relaxed">
                  <div className="text-slate-100">{formatInlineText(mainPart)}</div>
                  {subPart && (
                    <div className="mt-1 text-[11.5px] text-slate-400 flex items-center gap-1.5 pl-1 border-l-2 border-slate-700">
                      <span>{formatInlineText(subPart)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )
    }
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()

    if (!line) {
      flushBullets(`b-flush-${index}`)
      flushNumbered(`n-flush-${index}`)
      return
    }

    // Main Header (### ...)
    if (line.startsWith('### ')) {
      flushBullets(`b-flush-${index}`)
      flushNumbered(`n-flush-${index}`)
      const headingText = line.replace(/^###\s+/, '')
      blocks.push(
        <div
          key={`h3-${index}`}
          className="flex items-center gap-2 mt-3.5 mb-2 pb-1.5 border-b border-slate-700/70 text-teal-300 font-bold text-[13.5px] tracking-wide"
        >
          <span>{formatInlineText(headingText)}</span>
        </div>
      )
      return
    }

    // Sub Header (#### ...)
    if (line.startsWith('#### ')) {
      flushBullets(`b-flush-${index}`)
      flushNumbered(`n-flush-${index}`)
      const subHeadingText = line.replace(/^####\s+/, '')
      blocks.push(
        <div
          key={`h4-${index}`}
          className="flex items-center gap-1.5 mt-2.5 mb-1 text-slate-200 font-semibold text-[12.5px] tracking-wide"
        >
          <span>{formatInlineText(subHeadingText)}</span>
        </div>
      )
      return
    }

    // Numbered Item (1. ..., 2. ...)
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      flushBullets(`b-flush-${index}`)
      currentNumbered.push(numMatch[2])
      return
    }

    // Bullet Item (- ..., * ...)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushNumbered(`n-flush-${index}`)
      currentBullets.push(line.slice(2).trim())
      return
    }

    // General Paragraph
    flushBullets(`b-flush-${index}`)
    flushNumbered(`n-flush-${index}`)

    blocks.push(
      <p key={`p-${index}`} className="text-[13px] leading-relaxed text-slate-200 my-1">
        {formatInlineText(line)}
      </p>
    )
  })

  flushBullets('b-flush-end')
  flushNumbered('n-flush-end')

  return <div className="space-y-1">{blocks}</div>
}
