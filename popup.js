document.getElementById('open-antagning').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.antagning.se' });
});