export function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-red">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-dim">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
