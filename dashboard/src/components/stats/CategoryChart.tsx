import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCategoryMeta } from '../../utils/categoryMeta';

interface CategoryChartProps {
  categories: Record<string, number>;
}

const CHART_COLORS: Record<string, string> = {
  roads: '#ea580c',
  sanitation: '#16a34a',
  water: '#2563eb',
  electricity: '#ca8a04',
  encroachment: '#dc2626',
  parks: '#059669',
  public_safety: '#9333ea',
  health: '#db2777',
  education: '#4f46e5',
  transport: '#0d9488',
  housing: '#d97706',
  general: '#6b7280',
};

export default function CategoryChart({ categories }: CategoryChartProps) {
  const data = Object.entries(categories)
    .map(([key, count]) => ({
      name: getCategoryMeta(key).name,
      count,
      key,
    }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Issues by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            formatter={(value) => [value, 'Issues']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={CHART_COLORS[entry.key] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
