export interface Bank {
  name: string;
  ticker: string;
}

export interface BankData extends Bank {
  currentPrice: number;
  todayChange: number;
  monthChange: number;
  ytdChange: number;
  yearChange: number;
  lastUpdated: Date;
  volumeAlert?: VolumeAlert;
  priceAlert?: PriceAlert;
}

export interface VolumeAlert {
  currentVolume: number;
  avgVolume: number;
  stdDev: number;
  deviations: number;
  severity: 'normal' | 'warning' | 'high';
}

export interface PriceAlert {
  type: 'high' | 'low' | 'none';
  message: string;
  changePercent: number;
}

export interface FinancialStatement {
  date: string;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
  eps?: number;
  operatingIncome?: number;
}

export type Period = 'today' | 'month' | 'ytd' | 'year';

export const BANKS: Bank[] = [
  { name: 'DNB.OL', ticker: 'DNB.OL' },
  { name: 'SB1NO.OL', ticker: 'SB1NO.OL' },
  { name: 'SBNOR.OL', ticker: 'SBNOR.OL' },
  { name: 'MING.OL', ticker: 'MING.OL' },
  { name: 'SPOL.OL', ticker: 'SPOL.OL' },
  { name: 'NONG.OL', ticker: 'NONG.OL' },
  { name: 'MORG.OL', ticker: 'MORG.OL' },
  { name: 'SPOG.OL', ticker: 'SPOG.OL' },
  { name: 'HELG.OL', ticker: 'HELG.OL' },
  { name: 'ROGS.OL', ticker: 'ROGS.OL' },
  { name: 'RING.OL', ticker: 'RING.OL' },
  { name: 'SOAG.OL', ticker: 'SOAG.OL' },
  { name: 'SNOR.OL', ticker: 'SNOR.OL' },
  { name: 'HGSB.OL', ticker: 'HGSB.OL' },
  { name: 'JAREN.OL', ticker: 'JAREN.OL' },
  { name: 'AURG.OL', ticker: 'AURG.OL' },
  { name: 'SKUE.OL', ticker: 'SKUE.OL' },
  { name: 'MELG.OL', ticker: 'MELG.OL' },
  { name: 'SOGN.OL', ticker: 'SOGN.OL' },
  { name: 'HSPG.OL', ticker: 'HSPG.OL' },
  { name: 'VVL.OL', ticker: 'VVL.OL' },
  { name: 'BIEN.OL', ticker: 'BIEN.OL' },
];
