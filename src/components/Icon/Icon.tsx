import type { ReactNode } from 'react'
type IconName = 'droplet' | 'steam' | 'scale' | 'tank' | 'moon' | 'settings' | 'arrow' | 'spark'
const paths: Record<IconName, ReactNode> = {
  droplet: <path d="M12 2S6.5 8.2 6.5 13a5.5 5.5 0 0 0 11 0C17.5 8.2 12 2 12 2Z" />,
  steam: <><path d="M8 18c-2-2 2-3 0-5s2-3 0-5"/><path d="M14 18c-2-2 2-3 0-5s2-3 0-5"/></>, scale: <><path d="M5 7h14l2 13H3L5 7Z"/><path d="M9 11a3 3 0 0 1 6 0"/></>, tank: <><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 14c3-2 5 2 8 0v4H8v-4Z"/></>, moon: <path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5Z"/>, settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>, arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>, spark: <path d="m12 2 1.4 5.1L18 10l-4.6 2.9L12 18l-1.4-5.1L6 10l4.6-2.9L12 2Z"/>,
}
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg> }
