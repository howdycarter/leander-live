import { cva, type VariantProps } from "class-variance-authority";
import { Badge as ArcBadge, type BadgeProps as ArcProps } from "../arc/badge/badge";
import { cn } from "@/lib/utils";
const badgeVariants = cva("inline-flex min-h-0 items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold leading-normal tracking-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", { variants: { variant: {
  default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
  outline: "bg-transparent text-foreground",
  accent: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
}}, defaultVariants: { variant: "default" } });
export interface BadgeProps extends ArcProps, VariantProps<typeof badgeVariants> {}
export function Badge({ variant, className, ...props }: BadgeProps) { return <ArcBadge className={cn("arc-badge-compat", badgeVariants({ variant, className }))} {...props} />; }
export { badgeVariants };
