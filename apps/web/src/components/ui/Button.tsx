import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-soft hover:shadow-medium',
    secondary: 'bg-white text-primary-600 border border-primary-200 hover:bg-primary-50 focus:ring-primary-500 shadow-soft hover:shadow-medium',
    destructive: 'bg-white text-error-600 border border-error-200 hover:bg-error-50 focus:ring-error-500 shadow-soft hover:shadow-medium',
    ghost: 'bg-transparent text-text-600 hover:bg-text-100 focus:ring-text-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-base rounded-lg',
    lg: 'px-6 py-3 text-lg rounded-xl'
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  
  const renderIcon = () => {
    if (!Icon) return null;
    
    if (isLoading) {
      return (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      );
    }
    
    return <Icon className="w-4 h-4" />;
  };
  
  const renderContent = () => {
    if (Icon && iconPosition === 'left') {
      return (
        <>
          {renderIcon()}
          {children}
        </>
      );
    }
    
    if (Icon && iconPosition === 'right') {
      return (
        <>
          {children}
          {renderIcon()}
        </>
      );
    }
    
    return children;
  };
  
  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {renderContent()}
    </button>
  );
}
