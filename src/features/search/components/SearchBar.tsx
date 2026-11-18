import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'

export interface SearchBarProps {
  id: string
  defaultValue?: string
  maxLength?: number
  className?: string
  onSearch?: (query: string) => void
}

export function SearchBar({ id, defaultValue = '', maxLength, className, onSearch }: SearchBarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(defaultValue)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (onSearch) {
      onSearch(trimmed)
      return
    }
    navigate(trimmed ? `${ROUTES.search}?q=${encodeURIComponent(trimmed)}` : ROUTES.search)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn('w-full', className)}>
      <label htmlFor={id} className="sr-only">
        Buscar servicios o profesionales
      </label>
      <Input
        id={id}
        type="search"
        value={query}
        maxLength={maxLength}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="¿Qué servicio necesitas?"
        leftIcon={Search}
        enterKeyHint="search"
        className="h-13 rounded-lg border-transparent shadow-md"
      />
    </form>
  )
}
