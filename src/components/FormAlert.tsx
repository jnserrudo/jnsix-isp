import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface FormAlertProps {
  message: string | null;
}

const FormAlert: React.FC<FormAlertProps> = ({ message }) => {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && alertRef.current) {
      alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [message]);

  if (!message) return null;

  return (
    <div 
      ref={alertRef}
      style={{ 
        backgroundColor: 'var(--color-danger-bg)', 
        border: '1px solid rgba(239, 68, 68, 0.3)', 
        color: 'var(--color-danger)', 
        padding: '0.85rem 1rem', 
        marginBottom: '1.25rem', 
        fontSize: '0.9rem',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{message}</span>
    </div>
  );
};

export default FormAlert;
