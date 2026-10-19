import {
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
