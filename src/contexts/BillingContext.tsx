import React, { createContext, useContext, useState, ReactNode } from 'react';
import { showToast } from '../utils/toast';

interface BillingProgress {
  current: number;
  total: number;
  percentage: number;
}

interface BillingContextProps {
  isBillingRunning: boolean;
  billingProgress: BillingProgress | null;
  startBilling: (token: string, nodeId?: string) => Promise<void>;
}

const BillingContext = createContext<BillingContextProps | undefined>(undefined);

export const BillingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isBillingRunning, setIsBillingRunning] = useState(false);
  const [billingProgress, setBillingProgress] = useState<BillingProgress | null>(null);

  const startBilling = async (token: string, nodeId?: string) => {
    if (isBillingRunning) return;
    
    setIsBillingRunning(true);
    setBillingProgress({ current: 0, total: 0, percentage: 0 });
    
    const es = new EventSource(`/api/invoices/billing-progress?token=${token}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.nodeId === (nodeId || 'ALL')) {
          setBillingProgress({ current: data.current, total: data.total, percentage: data.percentage });
        }
      } catch (e) {}
    };

    try {
      const response = await fetch('/api/invoices/trigger-billing', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nodeId: nodeId || undefined })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al gatillar facturación');
      
      const msg = data.count > 0 
        ? `Proceso de facturación en 2do plano completado. Se generaron ${data.count} facturas nuevas.`
        : `Proceso en 2do plano completado. Todos los clientes ya se encontraban facturados (0 facturas nuevas).`;
      
      showToast(msg, 'success');
      
      // Dispatch a custom event so other components (like Dashboard) can refresh their data
      window.dispatchEvent(new Event('billing-completed'));
    } catch (err: any) {
      const errMsg = err.message || 'Fallo de facturación manual';
      showToast(errMsg, 'warning');
    } finally {
      es.close();
      setBillingProgress(null);
      setIsBillingRunning(false);
    }
  };

  return (
    <BillingContext.Provider value={{ isBillingRunning, billingProgress, startBilling }}>
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
};
