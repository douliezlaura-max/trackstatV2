import {
  Coins,
  Crown,
  Droplet,
  Egg,
  Gem,
  HandFist,
  PawPrint,
  Sparkles,
  Star,
  Sword,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/games";

export const STAT_ICONS: Record<IconName, LucideIcon> = {
  users: Users,
  coins: Coins,
  paw: PawPrint,
  egg: Egg,
  gem: Gem,
  trending: TrendingUp,
  fist: HandFist,
  sword: Sword,
  droplet: Droplet,
  star: Star,
  crown: Crown,
  sparkles: Sparkles,
};

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.37 2.8a13.7 13.7 0 0 0-.63 1.3 18.4 18.4 0 0 0-5.49 0 12.6 12.6 0 0 0-.64-1.3 19.7 19.7 0 0 0-4.96 1.54C.53 9.05-.32 13.58.1 18.06a19.9 19.9 0 0 0 6.07 3.07c.49-.67.93-1.38 1.3-2.12a12.9 12.9 0 0 1-2.04-.98c.17-.13.34-.26.5-.39a14.2 14.2 0 0 0 12.14 0c.17.14.33.27.5.39-.65.39-1.33.72-2.05.98.38.75.81 1.45 1.3 2.12a19.8 19.8 0 0 0 6.08-3.07c.5-5.18-.84-9.68-3.58-13.69ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}
