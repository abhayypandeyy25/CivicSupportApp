import {
  Route, Trash2, Droplets, Zap, Building, Trees,
  Shield, Heart, GraduationCap, Bus, Home, Info,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryMeta {
  name: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const categoryMeta: Record<string, CategoryMeta> = {
  roads:         { name: 'Roads & Traffic',     icon: Route,         color: 'text-orange-600', bgColor: 'bg-orange-100' },
  sanitation:    { name: 'Sanitation',          icon: Trash2,        color: 'text-green-600',  bgColor: 'bg-green-100' },
  water:         { name: 'Water Supply',        icon: Droplets,      color: 'text-blue-600',   bgColor: 'bg-blue-100' },
  electricity:   { name: 'Electricity',         icon: Zap,           color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  encroachment:  { name: 'Encroachment',        icon: Building,      color: 'text-red-600',    bgColor: 'bg-red-100' },
  parks:         { name: 'Parks',               icon: Trees,         color: 'text-emerald-600',bgColor: 'bg-emerald-100' },
  public_safety: { name: 'Public Safety',       icon: Shield,        color: 'text-purple-600', bgColor: 'bg-purple-100' },
  health:        { name: 'Health',              icon: Heart,         color: 'text-pink-600',   bgColor: 'bg-pink-100' },
  education:     { name: 'Education',           icon: GraduationCap, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  transport:     { name: 'Transport',           icon: Bus,           color: 'text-teal-600',   bgColor: 'bg-teal-100' },
  housing:       { name: 'Housing',             icon: Home,          color: 'text-amber-600',  bgColor: 'bg-amber-100' },
  general:       { name: 'General',             icon: Info,          color: 'text-gray-600',   bgColor: 'bg-gray-100' },
};

export function getCategoryMeta(categoryId: string): CategoryMeta {
  return categoryMeta[categoryId] || categoryMeta.general;
}
