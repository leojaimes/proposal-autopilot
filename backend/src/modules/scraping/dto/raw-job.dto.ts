export interface RawApifyUpworkJob {
  id: string;
  title: string;
  description: string;
  url: string;
  postedDate?: string;
  budget?: {
    type?: string;
    amount?: number;
    min?: number;
    max?: number;
    currency?: string;
  };
  client?: {
    country?: string;
    totalSpent?: number;
    rating?: number;
    feedbackCount?: number;
    paymentVerificationStatus?: string;
  };
  proposals?: {
    count?: number;
    tier?: string;
  };
  skills?: string[];
  isPaymentVerified?: boolean;
}
