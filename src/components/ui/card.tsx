/** Composition helpers over UIARC's card; no substitute card implementation. */
import type { HTMLAttributes } from "react";
import { Card as ArcCard } from "../arc/card/card";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) { return <ArcCard className={cn("arc-composed-card", className)} {...props} />; }
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-card-header", className)} {...props} />; }
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h3 className={cn("arc-card-title", className)} {...props} />; }
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("arc-card-description", className)} {...props} />; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-card-content", className)} {...props} />; }
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-card-footer", className)} {...props} />; }
