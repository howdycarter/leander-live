/** Compound compatibility API retaining UIARC's dialog motion and Radix semantics. */
import { Children, isValidElement, forwardRef, useRef, type HTMLAttributes, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { DialogContent as ArcContent, type DialogContentProps } from "../arc/dialog/dialog";
import styles from "../arc/dialog/dialog.module.css";
import { cn } from "@/lib/utils";
export { Dialog, DialogTrigger, DialogClose } from "../arc/dialog/dialog";
export const DialogPortal = Primitive.Portal;
export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-dialog-heading", className)} {...props} />; }
export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("arc-dialog-footer", className)} {...props} />; }
export function DialogContent({ children, onOpenAutoFocus, onCloseAutoFocus, ...props }: DialogContentProps) {
  const opener = useRef<HTMLElement | null>(null);
  const nodes = Children.toArray(children);
  const header = nodes.find(node => isValidElement(node) && node.type === DialogHeader);
  return <ArcContent {...props} header={header} onOpenAutoFocus={event => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpenAutoFocus?.(event);
  }} onCloseAutoFocus={event => {
    onCloseAutoFocus?.(event);
    if (!event.defaultPrevented && opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
  }}><div className="arc-dialog-body">{nodes.filter(node => node !== header)}</div></ArcContent>;
}
export const DialogTitle = forwardRef<ElementRef<typeof Primitive.Title>, ComponentPropsWithoutRef<typeof Primitive.Title>>(function DialogTitle({ className, ...props }, ref) { return <Primitive.Title ref={ref} className={cn(styles.title, className)} {...props} />; });
export const DialogDescription = forwardRef<ElementRef<typeof Primitive.Description>, ComponentPropsWithoutRef<typeof Primitive.Description>>(function DialogDescription({ className, ...props }, ref) { return <Primitive.Description ref={ref} className={cn(styles.description, className)} {...props} />; });
