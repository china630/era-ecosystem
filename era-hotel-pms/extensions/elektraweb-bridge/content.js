window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== 'era-ew-bridge' || data.type !== 'elektraweb-select') return;
  chrome.runtime.sendMessage({ type: 'elektraweb-select', payload: data.payload });
});
