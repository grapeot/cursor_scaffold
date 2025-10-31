// Results component - displays programming results from Cursor Agent
function Result() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Results</h2>
        <p className="text-gray-500 text-lg">
          Your results and programming outputs will be displayed here.
        </p>
      </div>
    </div>
  );
}

export default Result;
