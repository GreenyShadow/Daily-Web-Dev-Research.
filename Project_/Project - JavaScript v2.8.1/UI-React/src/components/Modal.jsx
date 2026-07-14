import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Thin wrapper that keeps the original Modal API (title / onClose / children
// / width) so every existing caller (TicketDetailModal, form dialogs, etc.)
// is unaffected, while the actual rendering is now the shadcn/ui Dialog
// (Radix primitive) instead of the hand-rolled backdrop + panel markup.
export default function Modal({ title, onClose, children, width = 480 }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent width={width} aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
