import {
  BriefcaseBusiness,
  Hammer,
  HardHat,
  MonitorSmartphone,
  PaintRoller,
  ShowerHead,
  SprayCan,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from '@/types/category'

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  electricity: Zap,
  plumbing: ShowerHead,
  technology: MonitorSmartphone,
  cleaning: SprayCan,
  mechanics: Wrench,
  construction: HardHat,
  carpentry: Hammer,
  painting: PaintRoller,
}

function isKnownCategory(id: string): id is CategoryId {
  return Object.hasOwn(CATEGORY_ICONS, id)
}

/** Icon for any category id from the database (new ids get a generic icon). */
export function getCategoryIcon(id: string): LucideIcon {
  return isKnownCategory(id) ? CATEGORY_ICONS[id] : BriefcaseBusiness
}
