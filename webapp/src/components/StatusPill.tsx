export function StatusPill({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        running
          ? "bg-green-soft text-green"
          : "bg-surface-3 text-text-mute"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          running ? "bg-green" : "bg-text-mute"
        }`}
      />
      {running ? "Running" : "Stopped"}
    </span>
  );
}

export function TagPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-border-bright bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-dim">
      {children}
    </span>
  );
}
