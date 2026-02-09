import { getCategoryMeta } from '../../utils/categoryMeta';

export default function CategoryBadge({ categoryId }: { categoryId: string }) {
  const meta = getCategoryMeta(categoryId);
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.bgColor} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.name}
    </span>
  );
}
