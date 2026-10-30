import { forwardRef, type LabelHTMLAttributes } from "react";
import styles from "../arc/input/input.module.css";
import { cn } from "@/lib/utils";
/** Native label composed with UIARC's field label style. */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label({ className, ...props }, ref) { return <label ref={ref} className={cn(styles.label, "arc-label-compat", className)} {...props} />; });
