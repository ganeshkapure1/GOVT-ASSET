import React, { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      errorText,
      leftAddon,
      rightAddon,
      fullWidth = true,
      className = '',
      id,
      disabled = false,
      required = false,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || `input-${generatedId}`;
    const helperId = `helper-${inputId}`;
    const errorId = `error-${inputId}`;

    const hasError = Boolean(errorText);

    return (
      <div className={`${fullWidth ? 'w-full' : 'inline-block'} font-sans`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-civic-800 dark:text-slate-200 mb-1.5">
            {label}
            {required && <span className="text-danger-700 dark:text-rose-400 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex rounded-xl shadow-subtle">
          {leftAddon && (
            <div className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-civic-300 dark:border-slate-700 bg-civic-100 dark:bg-slate-800 text-civic-700 dark:text-slate-300 text-sm select-none">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            autoComplete={props.autoComplete ?? 'off'}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={`block w-full min-h-[44px] px-3.5 py-2 text-base text-civic-900 dark:text-slate-100 bg-white dark:bg-slate-900/90 border ${
              hasError
                ? 'border-danger-700 focus:ring-danger-700 focus:border-danger-700 dark:border-rose-500'
                : 'border-civic-300 dark:border-slate-700 focus:ring-brand-blue dark:focus:ring-blue-400 focus:border-brand-blue'
            } ${leftAddon ? 'rounded-r-xl' : rightAddon ? 'rounded-l-xl' : 'rounded-xl'} ${
              disabled ? 'bg-civic-100 dark:bg-slate-800/50 text-civic-500 dark:text-slate-500 cursor-not-allowed' : ''
            } focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 transition-all duration-150 ${className}`}
            {...props}
          />
          {rightAddon && (
            <div className="inline-flex items-center px-3.5 rounded-r-xl border border-l-0 border-civic-300 dark:border-slate-700 bg-civic-100 dark:bg-slate-800 text-civic-700 dark:text-slate-300 text-sm select-none">
              {rightAddon}
            </div>
          )}
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

Input.displayName = 'Input';
