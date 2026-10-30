import { forwardRef } from "react";
import { Input as ArcInput, type InputProps } from "../arc/input/input";
import { cn } from "@/lib/utils";
export type { InputProps } from "../arc/input/input";
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) { return <ArcInput ref={ref} className={cn("flex h-9 min-h-0 w-full rounded-md border border-input bg-background px-3 py-1 text-sm leading-normal shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />; });
