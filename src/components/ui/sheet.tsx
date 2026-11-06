/**
 * UIARC has Drawer, not Sheet. This leftover shadcn sheet is replaced by
 * the Arc Drawer so the component layer does not keep a hand-rolled duplicate.
 * Unused in application routes today.
 */
export {
  Drawer as Sheet,
  DrawerTrigger as SheetTrigger,
  DrawerClose as SheetClose,
  DrawerContent as SheetContent,
  useDrawerItem,
} from "../arc/drawer/drawer";
