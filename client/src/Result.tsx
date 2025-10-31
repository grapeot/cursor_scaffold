import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StockDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  data: StockDataPoint[];
  lastUpdate: string;
}

// Results component - displays programming results from Cursor Agent
function Result() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Dynamically calculate API URL
        const hostname = window.location.hostname;
        const apiBase = hostname === 'localhost' || hostname === '127.0.0.1' 
          ? 'http://localhost:3001' 
          : `http://${hostname}:3001`;
        
        const response = await fetch(`${apiBase}/api/stock/amazon`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setStockData(data);
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStockData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format time for display
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Prepare chart data
  const chartData = stockData?.data.map(point => ({
    time: formatTime(point.time),
    price: point.close,
    open: point.open,
    high: point.high,
    low: point.low,
  })) || [];

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-6xl">
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500">Loading stock data...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Error loading stock data</div>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        )}

        {stockData && !loading && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {stockData.name} ({stockData.symbol})
              </h2>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-semibold text-blue-600">
                  ${stockData.currentPrice.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">
                  Last updated: {new Date(stockData.lastUpdate).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Stock Price Today</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={false}
                    name="Close Price"
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Open</div>
                <div className="text-xl font-semibold">
                  ${stockData.data[0]?.open.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">High</div>
                <div className="text-xl font-semibold text-green-600">
                  ${Math.max(...stockData.data.map(d => d.high)).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Low</div>
                <div className="text-xl font-semibold text-red-600">
                  ${Math.min(...stockData.data.map(d => d.low)).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Current</div>
                <div className="text-xl font-semibold text-blue-600">
                  ${stockData.currentPrice.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Result;
