import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
/** A semantic rule using UIARC foundation tokens, not a separate component library. */
export function Separator({ orientation = "horizontal", decorative = true, className, ...props }: HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical"; decorative?: boolean }) { return <div role={decorative ? "none" : "separator"} aria-orientation={decorative ? undefined : orientation} className={cn("arc-separator", orientation === "vertical" && "arc-separator-vertical", className)} {...props} />; }
