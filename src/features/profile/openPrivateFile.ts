/**
 * Opens a private file through a short-lived signed URL.
 * The tab is opened synchronously (inside the click) so popup blockers allow
 * it, and the URL is assigned once the signed URL is ready.
 */
export async function openPrivateFile(getUrl: () => Promise<string>): Promise<void> {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const url = await getUrl()
    if (tab) tab.location.href = url
    else window.location.assign(url)
  } catch (error) {
    tab?.close()
    throw error
  }
}

