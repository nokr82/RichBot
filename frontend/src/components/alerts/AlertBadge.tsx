interface Props {
  eventType: string;
}

export default function AlertBadge({ eventType }: Props) {
  const isGolden = eventType.startsWith("GOLDEN");
  const maPair = eventType.replace(/^(GOLDEN|DEAD)_/, "").replace("_", "/");
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isGolden ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
      {isGolden ? "골든" : "데드"} MA{maPair}
    </span>
  );
}
