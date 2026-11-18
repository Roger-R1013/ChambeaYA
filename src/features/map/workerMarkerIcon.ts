import { divIcon, type DivIcon } from 'leaflet'
import type { NearbyWorker } from '@/types/worker'
import { getFullName, getInitials } from '@/utils/format'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/**
 * Marker for a worker at their APPROXIMATE public point. Built as a divIcon
 * (no image assets, every value HTML-escaped).
 */
export function workerMarkerIcon(worker: NearbyWorker, selected: boolean): DivIcon {
  const name = getFullName(worker)
  const content = worker.avatarUrl
    ? `<img src="${escapeHtml(worker.avatarUrl)}" alt="" draggable="false" class="size-full rounded-full object-cover" />`
    : escapeHtml(getInitials(name))
  const dot = worker.availability === 'available' ? 'bg-success-500' : 'bg-accent-500'
  const ring = selected ? 'ring-4 ring-primary-300 scale-110' : 'ring-2 ring-white'

  return divIcon({
    className: 'chambea-worker-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html:
      `<span class="pointer-events-none relative flex size-11 items-center justify-center rounded-full bg-brand-gradient text-label font-semibold text-white shadow-md transition-transform duration-200 ${ring}">` +
      content +
      `<span class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-white ${dot}"></span>` +
      `</span>`,
  })
}

