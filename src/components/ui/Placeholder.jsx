// Temporary content block for pages whose data layer lands in later steps.
export default function Placeholder({ note }) {
  return (
    <div className="nexus-card flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="nexus-label">Section en cours de construction</span>
      <p className="max-w-md text-[13px] text-secondary">{note}</p>
    </div>
  )
}
