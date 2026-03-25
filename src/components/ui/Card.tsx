import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hover = false, padding = 'md' }: CardProps) {
  const baseClasses = 'glass rounded-2xl';
  const hoverClasses = hover ? 'hover:border-outline transition-all duration-200' : '';

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  };

  const classes = `${baseClasses} ${hoverClasses} ${paddingClasses[padding]} ${className}`;

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`pb-4 ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`pt-4 border-t border-outline-variant ${className}`}>
      {children}
    </div>
  );
}
