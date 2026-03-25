import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-display';

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'border border-outline text-on-surface-variant hover:bg-surface-high hover:text-on-surface rounded-xl',
    destructive: 'border border-error/30 text-error hover:bg-error-container rounded-xl',
    ghost: 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface rounded-xl',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // For primary variant, btn-primary utility class handles all styling
  const isPrimary = variant === 'primary';
  const classes = isPrimary
    ? `${baseClasses} ${variantClasses.primary} ${sizeClasses[size]} ${className}`
    : `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
