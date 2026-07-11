import { Children } from 'react'
import { RevealStagger, Reveal } from './Reveal'

// Standard padded page wrapper. Only the page title is shown in the header — the
// gray descriptive subtitles were removed for a cleaner, more spacious look (the
// `description` prop is accepted but intentionally not rendered). On mount, the
// header and each top-level content section ease in (fade + rise) in a gentle
// cascade, so every page gets the entrance animation for free.
export default function PageContainer({ title, actions, children }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <RevealStagger wrap={false}>
        <Reveal>
          <header className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
            {actions}
          </header>
        </Reveal>
        {Children.map(children, (child) =>
          child == null || child === false ? child : <Reveal>{child}</Reveal>,
        )}
      </RevealStagger>
    </div>
  )
}
