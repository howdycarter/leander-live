import { Badge as ArcBadge, type BadgeProps as ArcBadgeProps } from "../arc/badge/badge";
export interface BadgeProps extends ArcBadgeProps { variant?: "default" | "secondary" | "destructive" | "outline" }
export function Badge({ variant, tone, ...props }: BadgeProps) { return <ArcBadge tone={tone ?? (variant === "destructive" ? "danger" : "neutral")} {...props} />; }
