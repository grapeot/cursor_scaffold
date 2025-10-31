// Results component - displays programming results from Cursor Agent
function Result() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      <div className="bg-white rounded-lg shadow-lg p-12 w-full max-w-4xl text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Result Tab</h2>
          <p className="text-gray-500 text-lg">
            This tab can be used to display code execution results
          </p>
        </div>
      </div>
    </div>
  );
}

export default Result;
