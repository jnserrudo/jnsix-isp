export const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
  if ((window as any).showToast) {
    (window as any).showToast(message, type);
  } else {
    console.log(`[Toast Fallback] ${type.toUpperCase()}: ${message}`);
  }
};
