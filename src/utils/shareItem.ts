export interface ShareOptions {
  title: string;
  itemType: 'past-question' | 'announcement' | 'quiz' | 'course';
  id?: string;
  code?: string;
  textDetails?: string;
}

/**
 * Shares an academic item using the Web Share API on mobile / supporting devices,
 * falling back to WhatsApp (wa.me) share link.
 */
export async function shareItem(options: ShareOptions): Promise<void> {
  const baseUrl = window.location.origin;
  let link = baseUrl;
  if (options.itemType === 'past-question') {
    link = `${baseUrl}/?open=past-question&id=${encodeURIComponent(options.id || '')}`;
  } else if (options.itemType === 'announcement') {
    link = `${baseUrl}/?open=announcement&id=${encodeURIComponent(options.id || '')}`;
  } else if (options.itemType === 'quiz') {
    link = `${baseUrl}/?open=quiz&id=${encodeURIComponent(options.id || '')}`;
  } else if (options.itemType === 'course') {
    link = `${baseUrl}/?open=course&code=${encodeURIComponent(options.code || options.id || '')}`;
  }

  const shareTitle = `${options.title} | School of Technology (SOT)`;
  const shareText = `${options.title}${options.textDetails ? ` - ${options.textDetails}` : ''}\n${link}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: options.title + (options.textDetails ? ` (${options.textDetails})` : ''),
        url: link
      });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User dismissed share sheet
    }
  }

  // Fallback to WhatsApp wa.me
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}
