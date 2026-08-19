import React, { useRef, useImperativeHandle } from 'react';
import { formatNumber, parseNumberFromInput } from '../utils/formatters';

export interface FormattedNumberInputProps {
  value: number | string;
  onChange: (value: string, numericValue: number) => void;
  className?: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  className = 'form-input',
  placeholder = '0',
  inputRef: externalRef,
  required = false,
  autoFocus = false,
  id,
  style,
  onKeyDown,
  disabled = false,
}) => {
  const internalRef = useRef<HTMLInputElement>(null);

  // Sync internal ref with external ref if provided
  useImperativeHandle(externalRef, () => internalRef.current as HTMLInputElement);

  const numericValue = typeof value === 'number' ? value : parseNumberFromInput(value);
  const displayValue = numericValue > 0 ? formatNumber(numericValue) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawText = input.value;
    const currentCursor = input.selectionStart ?? rawText.length;

    // Count how many numeric digits were before the cursor
    const digitsBeforeCursor = rawText.slice(0, currentCursor).replace(/[^0-9]/g, '').length;

    const rawNum = parseNumberFromInput(rawText);
    const newFormatted = rawNum > 0 ? formatNumber(rawNum) : '';

    // Calculate target cursor position in new formatted string
    let targetCursor = 0;
    let countedDigits = 0;

    for (let i = 0; i < newFormatted.length; i++) {
      if (/\d/.test(newFormatted[i])) {
        countedDigits++;
      }
      if (countedDigits === digitsBeforeCursor) {
        targetCursor = i + 1;
        break;
      }
    }

    if (countedDigits < digitsBeforeCursor) {
      targetCursor = newFormatted.length;
    }

    onChange(rawNum > 0 ? rawNum.toString() : '', rawNum);

    // Restore caret position seamlessly after React state re-render
    requestAnimationFrame(() => {
      if (internalRef.current) {
        const safePos = Math.min(targetCursor, internalRef.current.value.length);
        internalRef.current.setSelectionRange(safePos, safePos);
      }
    });
  };

  return (
    <input
      ref={internalRef}
      id={id}
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      required={required}
      autoFocus={autoFocus}
      disabled={disabled}
      style={style}
      autoComplete="off"
    />
  );
};
