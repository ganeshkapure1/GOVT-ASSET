import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-blue text-white hover:bg-brand-dark active:bg-blue-900 dark:hover:bg-blue-600 border border-transparent shadow-subtle hover:shadow-card active:scale-[0.99] transition-all duration-150',
  secondary:
    'bg-civic-800 dark:bg-slate-800 text-white hover:bg-civic-900 dark:hover:bg-slate-700 active:bg-slate-950 border border-transparent dark:border-slate-700 shadow-subtle hover:shadow-card active:scale-[0.99] transition-all duration-150',
  outline:
    'bg-white text-civic-800 dark:bg-slate-900 dark:text-slate-100 border border-civic-300 dark:border-slate-700 hover:bg-civic-50 dark:hover:bg-slate-800 hover:border-civic-400 dark:hover:border-slate-600 active:bg-civic-100 shadow-subtle transition-all duration-150',
  danger:
    'bg-danger-700 text-white hover:bg-danger-800 active:bg-red-950 dark:bg-danger-700 dark:hover:bg-danger-800 border border-transparent shadow-subtle transition-all duration-150',
  ghost:
    'bg-transparent text-civic-700 dark:text-slate-300 hover:bg-civic-100 dark:hover:bg-slate-800/70 hover:text-civic-900 dark:hover:text-white active:bg-civic-200 border border-transparent transition-all duration-150',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[36px]',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-xl min-h-[44px]',
  lg: 'px-6 py-3 text-base font-bold rounded-xl min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-sans focus:outline-none focus:ring-2 focus:ring-brand-blue dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed select-none';
    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            data-testid="loading-spinner"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="mr-2 inline-flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="ml-2 inline-flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
