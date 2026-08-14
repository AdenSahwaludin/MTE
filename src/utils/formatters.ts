export const formatRupiah = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  return new Intl.NumberFormat('id-ID').format(num);
};

export const parseNumberFromInput = (value: string): number => {
  if (!value) return 0;
  // Remove non-numeric characters except digits
  const clean = value.replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
};

export const formatDateIndo = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoDate;
  }
};

export const formatTimeOnly = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};
