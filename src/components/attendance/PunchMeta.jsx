import { baseURL } from '@/services/api'
import { Badge } from '@/components/ui/badge'

export default function PunchMeta({ meta }) {
  if (!meta) return null
  const isApp = meta.source === 'app'
  if (!isApp && !meta.selfie_url) return null
  const src = meta.selfie_url ? `${baseURL}${meta.selfie_url}` : null
  return (
    <div className="mt-1 flex items-center gap-1.5 font-sans">
      {isApp && <Badge variant="secondary">App</Badge>}
      {meta.distance_m != null && <span className="text-muted-foreground" title="Distance from the salon location at punch time">{Math.round(meta.distance_m)} m away</span>}
      {src && (
        <a href={src} target="_blank" rel="noreferrer" title="View selfie">
          <img src={src} alt="Selfie" className="h-6 w-6 rounded object-cover border" loading="lazy" />
        </a>
      )}
    </div>
  )
}
