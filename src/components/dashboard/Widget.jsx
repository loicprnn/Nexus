import { IconGripVertical, IconX } from '@tabler/icons-react'

// Frame for a dashboard widget: card + header + body. In edit mode the WHOLE
// card is the drag surface (react-grid-layout has no draggableHandle, only a
// draggableCancel=".widget-no-drag" so interactive controls like the remove
// button stay clickable). This makes a widget grabbable from anywhere — not
// just a thin header strip — which is the natural way to move it.
export default function Widget({ title, editing, onRemove, children }) {
  return (
    <div
      className={[
        'flex h-full flex-col overflow-hidden nexus-card',
        editing ? 'cursor-move select-none ring-1 ring-border' : '',
      ].join(' ')}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b-hairline border-border px-4">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {editing && (
            <IconGripVertical size={14} stroke={1.5} className="shrink-0 text-secondary" />
          )}
          <span className="truncate text-[12px] font-semibold text-primary">{title}</span>
        </div>
        {editing && (
          <button
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
            className="widget-no-drag shrink-0 text-secondary transition-colors hover:text-down"
            aria-label={`Retirer ${title}`}
          >
            <IconX size={15} stroke={1.5} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
    </div>
  )
}
