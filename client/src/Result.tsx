import { useEffect, useState } from 'react';

interface Article {
  title: string;
  content: string;
  url: string;
}

interface ArticlesResponse {
  articles: Article[];
  count: number;
}

// Auto-detect API base URL
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${hostname}:3001`;
};

// Results component - displays programming results from Cursor Agent
function Result() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/api/articles/yage`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch articles: ${response.statusText}`);
        }
        
        const data: ArticlesResponse = await response.json();
        setArticles(data.articles || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch articles');
        console.error('Error fetching articles:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-4xl">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading Articles</h2>
            <p className="text-gray-500">Fetching articles from yage.ai...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-4xl">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-red-700 mb-4">Error</h2>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-4xl text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">No Articles Found</h2>
          <p className="text-gray-500">No English articles were found on yage.ai.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Articles from yage.ai</h2>
        <p className="text-gray-600">Found {articles.length} English article{articles.length !== 1 ? 's' : ''}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-semibold text-gray-800 mb-3 line-clamp-2">
                {article.title}
              </h3>
              <div className="flex-1 overflow-hidden">
                <p className="text-gray-600 text-sm line-clamp-6 whitespace-pre-wrap">
                  {article.content}
                </p>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Read more ?
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Result;
