import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  helperText?: string;
}

export function Input({
  label,
  error,
  icon: Icon,
  iconPosition = 'left',
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseClasses = 'w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 placeholder:text-text-400';
  const stateClasses = error 
    ? 'border-error-300 focus:ring-error-500 focus:border-error-500' 
    : 'border-text-200 focus:ring-primary-500 focus:border-primary-500';
  
  const inputClasses = `${baseClasses} ${stateClasses} ${className}`;
  
  const iconClasses = 'w-5 h-5 text-text-400';
  
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-700">
          {label}
        </label>
      )}
      
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Icon className={iconClasses} />
          </div>
        )}
        
        <input
          id={inputId}
          className={`${inputClasses} ${Icon && iconPosition === 'left' ? 'pl-10' : ''} ${Icon && iconPosition === 'right' ? 'pr-10' : ''}`}
          {...props}
        />
        
        {Icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Icon className={iconClasses} />
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-error-600 flex items-center gap-1">
          <span className="w-1 h-1 bg-error-600 rounded-full"></span>
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-text-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
