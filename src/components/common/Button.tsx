import React from 'react';
import { colors } from '../../styles/colors';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s',
    width: fullWidth ? '100%' : 'auto',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: colors.primary,
      color: colors.dark.bg,
    },
    secondary: {
      backgroundColor: colors.dark.bgSecondary,
      color: colors.dark.text,
      border: `1px solid ${colors.dark.border}`,
    },
    danger: {
      backgroundColor: colors.danger,
      color: colors.dark.text,
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '14px',
    },
    md: {
      padding: '10px 16px',
      fontSize: '14px',
    },
    lg: {
      padding: '12px 20px',
      fontSize: '16px',
    },
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
      {...props}
    >
      {children}
    </button>
  );
}
