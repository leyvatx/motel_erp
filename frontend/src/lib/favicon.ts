const LINK_ID = 'app-favicon'

const FALLBACK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/>' +
      '<path d="M2 17h20"/><path d="M6 8v9"/></svg>',
  )

export function setFavicon(url: string | null): void {
  if (typeof document === 'undefined') return

  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.href = url ?? FALLBACK_ICON
}
