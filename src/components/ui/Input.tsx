import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseClasses = 'w-full px-4 py-2.5 bg-surface-container border rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors';
  const stateClasses = error
    ? 'border-error'
    : 'border-outline-variant';

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-on-surface-variant">
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={`${baseClasses} ${stateClasses} ${className}`}
        {...props}
      />

      {error && (
        <p className="text-xs text-error flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
          {error}
        </p>
      )}

      {helperText && !error && (
        <p className="text-xs text-on-surface-variant">{helperText}</p>
      )}
    </div>
  );
}
