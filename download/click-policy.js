(() => {
  const svg = document.querySelector('[data-testid=agent-flow-svg]');
  const allText = svg.querySelectorAll('text');
  let policyText = null;
  allText.forEach(t => { if(t.textContent === 'Policy') policyText = t; });
  if (!policyText) return 'NO_POLICY';
  // find the closest motion.g (a g element with style transformOrigin)
  let g = policyText.parentElement;
  while (g && g !== svg) {
    if (g.tagName === 'g' && g.style.transformOrigin) {
      const r = g.getBoundingClientRect();
      // dispatch a click at the center of the node
      g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
      return JSON.stringify({ clicked: true, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    }
    g = g.parentElement;
  }
  return 'NO_GROUP_WITH_TRANSFORM';
})()
