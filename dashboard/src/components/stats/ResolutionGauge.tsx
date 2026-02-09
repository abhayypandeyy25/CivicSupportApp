interface ResolutionGaugeProps {
  resolved: number;
  total: number;
}

export default function ResolutionGauge({ resolved, total }: ResolutionGaugeProps) {
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  let color = 'text-red-500';
  let strokeColor = '#ef4444';
  if (rate >= 70) { color = 'text-green-500'; strokeColor = '#22c55e'; }
  else if (rate >= 40) { color = 'text-amber-500'; strokeColor = '#f59e0b'; }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Rate</h3>
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={strokeColor} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{rate}%</span>
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-3">{resolved} of {total} resolved</p>
    </div>
  );
}
