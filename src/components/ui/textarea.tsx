import { forwardRef } from "react";
import { Textarea as ArcTextarea, type TextareaProps } from "../arc/textarea/textarea";
import { cn } from "@/lib/utils";
export type { TextareaProps } from "../arc/textarea/textarea";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) { return <ArcTextarea ref={ref} className={cn("flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-normal shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />; });
