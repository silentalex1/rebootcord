export function Logo({
  size = "md",
  spaced = false,
}: {
  size?: "sm" | "md" | "lg";
  spaced?: boolean;
}) {
  const cls = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <span className={`font-extrabold tracking-tight ${cls}`}>
      <span className="text-red">Reboot</span>
      {spaced ? " " : ""}
      <span className="text-text">Cord</span>
    </span>
  );
}
