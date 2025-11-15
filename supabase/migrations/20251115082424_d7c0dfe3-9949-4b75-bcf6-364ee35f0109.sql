-- Create signal_history table for storing pre-calculated signals
CREATE TABLE IF NOT EXISTS public.signal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  ticker TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_value NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_signal_per_day UNIQUE (date, ticker, signal_type)
);

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_signal_history_date_type ON public.signal_history(date, signal_type);
CREATE INDEX IF NOT EXISTS idx_signal_history_ticker ON public.signal_history(ticker);

-- Enable RLS
ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access (no auth needed for backtesting)
CREATE POLICY "Allow public read access to signal_history"
  ON public.signal_history
  FOR SELECT
  USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to manage signal_history"
  ON public.signal_history
  FOR ALL
  USING (auth.role() = 'service_role');