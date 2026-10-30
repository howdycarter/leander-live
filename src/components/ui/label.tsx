import { forwardRef, type LabelHTMLAttributes } from "react";
import styles from "../arc/input/input.module.css";
import { cn } from "@/lib/utils";
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label({ className, ...props }, ref) { return <label ref={ref} className={cn(styles.label, "mb-0 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />; });
