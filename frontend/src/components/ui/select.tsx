import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SelectBlocked = createContext(false);
export function SelectBoundary({ blocked, children }: { blocked: boolean; children: ReactNode }) {
  return <SelectBlocked.Provider value={blocked}>{children}</SelectBlocked.Provider>;
}

export function Select({ label, value, options, onChange, placeholder, className = '', disabled = false }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; placeholder?: string; className?: string; disabled?: boolean;
}) {
  const blocked = useContext(SelectBlocked);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (blocked) setOpen(false); }, [blocked]);
  return <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled || blocked}
    open={open && !blocked} onOpenChange={next => setOpen(next && !blocked)}>
    <SelectPrimitive.Trigger aria-label={label} className={`select-trigger ${className}`}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon className="select-chevron"><ChevronDown size={16} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="select-scroll"><ChevronUp size={16} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>
          {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} textValue={option.label} className="select-option">
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="select-check"><Check size={16} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll"><ChevronDown size={16} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
