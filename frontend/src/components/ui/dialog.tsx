import { useLanguage } from '../../lib/i18n';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  description = 'Review workspace information below.',
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  description?: string;
  onCloseAutoFocus?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content" onCloseAutoFocus={event => {
          if (onCloseAutoFocus) { event.preventDefault(); onCloseAutoFocus(); }
        }}>
          <DialogPrimitive.Title>{t(title)}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t(description)}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="dialog-close" aria-label={t('Close')}>
            <X size={18} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
