import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export const Separator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical"; decorative?: boolean }>(function Separator({ orientation = "horizontal", decorative = true, className, ...props }, ref) { return <div ref={ref} role={decorative ? "none" : "separator"} aria-orientation={decorative ? undefined : orientation} className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} {...props} />; });
