window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== 'era-ew-bridge') return;
  if (data.type === 'elektraweb-select') {
    chrome.runtime.sendMessage({ type: 'elektraweb-select', payload: data.payload });
  }
  if (data.type === 'elektraweb-token' && data.payload) {
    chrome.runtime.sendMessage({ type: 'elektraweb-token', payload: data.payload });
  }
});
