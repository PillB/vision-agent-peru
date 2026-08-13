(() => {
  const svg = document.querySelector('[data-testid=agent-flow-svg]');
  const allText = svg.querySelectorAll('text');
  let policyText = null;
  allText.forEach(t => { if(t.textContent === 'Policy') policyText = t; });
  if (!policyText) return 'NO_POLICY';
  let g = policyText.parentElement;
  let transforms = [];
  while (g && g !== svg) {
    transforms.push(g.tagName + ':' + (g.getAttribute('transform') || 'none'));
    if (g.tagName === 'g' && g.getAttribute('transform')) {
      const r = g.getBoundingClientRect();
      return JSON.stringify({ found: true, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), transform: g.getAttribute('transform') });
    }
    g = g.parentElement;
  }
  return JSON.stringify({ found: false, transforms });
})()
