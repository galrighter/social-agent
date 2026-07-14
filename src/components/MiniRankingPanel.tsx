import LeaderboardPanel, { type LeaderboardRow } from "./LeaderboardPanel";

export default function MiniRankingPanel({
  title,
  icon,
  variant,
  rows,
}: {
  title: string;
  icon: string;
  variant: "blue" | "deepblue" | "gold" | "purple" | "green";
  rows: LeaderboardRow[];
}) {
  return <LeaderboardPanel title={title} icon={icon} variant={variant} rows={rows} />;
}
