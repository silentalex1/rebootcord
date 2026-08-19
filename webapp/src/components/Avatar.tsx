export function Avatar({
  username,
  color,
  size = 32,
  onClick,
}: {
  username: string;
  color?: string;
  size?: number;
  onClick?: () => void;
}) {
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  return (
    <button
      onClick={onClick}
      style={{ width: size, height: size, background: color || "#ef4655" }}
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white transition hover:brightness-110"
      title={username}
    >
      {initial}
    </button>
  );
}
