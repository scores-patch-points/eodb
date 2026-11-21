// content.js — the eyes. Injected into every page; reads the page and hands its context to the background/popup on request.
// Nothing here is sent anywhere automatically: it only responds when the popup (or a future sidebar) asks for the page.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.t === 'page') {
    try {
      const text = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
      sendResponse({ ok: true, page: { title: document.title || '', url: location.href, text: text.slice(0, 20000) } });
    } catch (e) { sendResponse({ ok: false, error: String(e) }); }
  }
});
