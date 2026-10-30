import { forwardRef } from "react";
import { Checkbox as ArcCheckbox, type CheckboxProps } from "../arc/checkbox/checkbox";
import { cn } from "@/lib/utils";
export type { CheckboxProps } from "../arc/checkbox/checkbox";
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox({ className, ...props }, ref) { return <ArcCheckbox ref={ref} className={cn("arc-checkbox-compat peer h-4 w-4 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />; });
