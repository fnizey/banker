interface CalendarEvent {
  ticker: string;
  bankName: string;
  earningsDate?: Date;
  dividendDate?: Date;
  exDividendDate?: Date;
}

export const fetchBankCalendarEvents = async (tickers: string[]): Promise<CalendarEvent[]> => {
  const events: CalendarEvent[] = [];

  for (const ticker of tickers) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`;
      const url = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`Calendar API failed for ${ticker}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const calendarData = data.quoteSummary?.result?.[0]?.calendarEvents;
      
      console.log(`Calendar data for ${ticker}:`, calendarData);
      
      if (calendarData) {
        const event: CalendarEvent = {
          ticker,
          bankName: ticker.replace('.OL', ''),
        };

        if (calendarData.earnings?.earningsDate?.[0]) {
          event.earningsDate = new Date(calendarData.earnings.earningsDate[0] * 1000);
        }
        
        if (calendarData.dividendDate) {
          event.dividendDate = new Date(calendarData.dividendDate);
        }
        
        if (calendarData.exDividendDate) {
          event.exDividendDate = new Date(calendarData.exDividendDate);
        }

        if (event.earningsDate || event.dividendDate || event.exDividendDate) {
          events.push(event);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching calendar for ${ticker}:`, error);
    }
  }

  return events.sort((a, b) => {
    const dateA = a.earningsDate || a.dividendDate || a.exDividendDate;
    const dateB = b.earningsDate || b.dividendDate || b.exDividendDate;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });
};