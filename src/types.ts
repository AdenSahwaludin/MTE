export interface Product {
  id: string;
  name: string;
  aliases: string[]; // Nama lain / sinonim / sebutan lain produk
  price: number;
  category?: string;
  unit?: string; // pcs, meter, rol, set, dus, batang, pak, dll
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  qty: number;
  unit?: string;
  subtotal: number;
  isNewProduct?: boolean;
}

export interface Transaction {
  id: string;
  invoiceNo: string;
  date: string; // ISO string
  items: CartItem[];
  totalAmount: number;
  cashAmount: number;
  changeAmount: number;
  paymentMethod: 'cash' | 'transfer' | 'qris';
  customerName?: string;
  notes?: string;
}

export interface StoreProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  footerNote: string;
  paperSize: '58mm';
  showDateTime: boolean;
  showCashierName: boolean;
  cashierName: string;
  autoSaveProducts: boolean;
  currency: string;
}
