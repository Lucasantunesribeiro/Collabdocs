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
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200',
    destructive: 'bg-white text-red-600 border border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg'
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
