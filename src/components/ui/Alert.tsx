import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ type, title, children, className = '' }: AlertProps) {
  const alertConfig = {
    success: {
      icon: 'check_circle',
      classes: 'bg-surface-container border-success/30 text-on-surface',
      iconClasses: 'text-success',
    },
    error: {
      icon: 'error',
      classes: 'bg-error-container border-error/30 text-on-surface',
      iconClasses: 'text-error',
    },
    warning: {
      icon: 'warning',
      classes: 'bg-surface-container border-tertiary/30 text-on-surface',
      iconClasses: 'text-tertiary',
    },
    info: {
      icon: 'info',
      classes: 'bg-surface-container border-outline-variant text-on-surface',
      iconClasses: 'text-secondary',
    },
  };

  const config = alertConfig[type];

  return (
    <div className={`p-4 rounded-xl border ${config.classes} ${className}`}>
      <div className="flex gap-3">
        <span className={`material-symbols-outlined flex-shrink-0 mt-0.5 ${config.iconClasses}`} style={{ fontSize: '20px' }}>
          {config.icon}
        </span>
        <div className="flex-1">
          {title && (
            <h4 className="font-display font-semibold text-sm text-on-surface mb-1">
              {title}
            </h4>
          )}
          <div className="text-sm text-on-surface-variant">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
