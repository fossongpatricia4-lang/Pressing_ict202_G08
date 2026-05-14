export type Language = 'fr' | 'en';
export type Theme = 'light' | 'dark';
export type GarmentStatus = 'clean' | 'dirty' | 'washing' | 'rented' | 'repair';
export type PaymentStatus = 'paid' | 'unpaid';
export type PaymentMethod = 'cash' | 'card' | 'mobile';

export interface Business {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  logo?: string;
  activeBusinessId?: string;
}

export interface Garment {
  id: string;
  businessId: string;
  name: string;
  category: string;
  color: string;
  size: string;
  clientName: string;
  clientPhone: string;
  price: number;
  rentalPrice: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  availableForRent: boolean;
  status: GarmentStatus;
  image?: string;
  notes: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryItem[];
}

export interface HistoryItem {
  id: string;
  date: string;
  status: GarmentStatus;
  note: string;
}
