(() => {
  const btns = Array.from(document.querySelectorAll('button[aria-label="Export flow as SVG"]'));
  if (btns.length === 0) return 'NO_BTN';
  btns[0].click();
  return 'CLICKED';
})()
