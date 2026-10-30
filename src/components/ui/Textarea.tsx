import React, { forwardRef, useId, useState } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  showCount?: boolean;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      errorText,
      showCount = false,
      fullWidth = true,
      className = '',
      id,
      disabled = false,
      required = false,
      maxLength,
      value,
      defaultValue,
      onChange,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || `textarea-${generatedId}`;
    const helperId = `helper-${textareaId}`;
    const errorId = `error-${textareaId}`;

    const [charCount, setCharCount] = useState<number>(() => {
      if (typeof value === 'string') return value.length;
      if (typeof defaultValue === 'string') return defaultValue.length;
      return 0;
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    const hasError = Boolean(errorText);

    return (
      <div className={`${fullWidth ? 'w-full' : 'inline-block'} font-sans`}>
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <label htmlFor={textareaId} className="block text-sm font-semibold text-civic-800 dark:text-slate-200">
              {label}
              {required && <span className="text-danger-700 dark:text-rose-400 ml-1" aria-hidden="true">*</span>}
            </label>
          )}
          {showCount && maxLength && (
            <span className="text-xs text-civic-500 dark:text-slate-400 font-mono">
              {charCount} / {maxLength}
            </span>
          )}
        </div>
        <div className="relative rounded-xl shadow-subtle">
          <textarea
            ref={ref}
            id={textareaId}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            rows={rows}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            autoComplete={props.autoComplete ?? 'off'}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={`block w-full px-3.5 py-2.5 text-base text-civic-900 dark:text-slate-100 bg-white dark:bg-slate-900/90 border rounded-xl ${
              hasError
                ? 'border-danger-700 focus:ring-danger-700 focus:border-danger-700 dark:border-rose-500'
                : 'border-civic-300 dark:border-slate-700 focus:ring-brand-blue dark:focus:ring-blue-400 focus:border-brand-blue'
            } ${
              disabled ? 'bg-civic-100 dark:bg-slate-800/50 text-civic-500 dark:text-slate-500 cursor-not-allowed' : ''
            } focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 transition-all duration-150 resize-y ${className}`}
            {...props}
          />
        </div>
        {hasError && (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-danger-700 dark:text-rose-400" role="alert">
            {errorText}
          </p>
        )}
        {!hasError && helperText && (
          <p id={helperId} className="mt-1.5 text-xs text-civic-600 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
