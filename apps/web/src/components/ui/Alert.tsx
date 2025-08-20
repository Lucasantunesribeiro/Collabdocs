import React from 'react';
import { LucideIcon, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ type, title, children, className = '' }: AlertProps) {
  const alertConfig = {
    success: {
      icon: CheckCircle,
      classes: 'bg-success-50 border-success-200 text-success-800',
      iconClasses: 'text-success-600'
    },
    error: {
      icon: AlertCircle,
      classes: 'bg-error-50 border-error-200 text-error-800',
      iconClasses: 'text-error-600'
    },
    warning: {
      icon: AlertTriangle,
      classes: 'bg-warning-50 border-warning-200 text-warning-800',
      iconClasses: 'text-warning-600'
    },
    info: {
      icon: Info,
      classes: 'bg-info-50 border-info-200 text-info-800',
      iconClasses: 'text-info-600'
    }
  };
  
  const config = alertConfig[type];
  const Icon = config.icon;
  
  return (
    <div className={`p-4 rounded-lg border ${config.classes} ${className}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClasses}`} />
        <div className="flex-1">
          {title && (
            <h4 className="font-medium mb-1">
              {title}
            </h4>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
