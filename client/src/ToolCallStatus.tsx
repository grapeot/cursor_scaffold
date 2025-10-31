interface ToolCallStatusProps {
  total: number;
  completed: number;
}

function ToolCallStatus({ total, completed }: ToolCallStatusProps) {
  const pending = total - completed;
  const allCompleted = completed === total && total > 0;

  return (
    <div className="mr-auto max-w-[90%] bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
      <div className="flex items-center gap-2 text-xs text-gray-700">
        {allCompleted ? (
          <>
            <span className="text-green-600 font-semibold text-base">✓</span>
            <span>Tools completed</span>
          </>
        ) : (
          <>
            <div className="relative">
              <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              {pending > 1 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                  {pending}
                </span>
              )}
            </div>
            <span>Calling tools{pending > 1 ? ` (${pending} remaining)` : ''}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default ToolCallStatus;
