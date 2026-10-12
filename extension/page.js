// Self-contained: Chrome copies this function into the tab's isolated world.
function interactWithPage(action, payload) {
  if (action === 'read' && window.__mintiState && !window.__mintiState.dirty) return window.__mintiState.snapshot;
  if (!window.__mintiState) {
    window.__mintiState = {dirty:true,snapshot:null};
    new MutationObserver(() => {window.__mintiState.dirty = true;}).observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true});
    window.addEventListener('resize', () => {window.__mintiState.dirty = true;});
    document.addEventListener('scroll', () => {window.__mintiState.dirty = true;}, true);
  }
  const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const text = el => el ? (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ') : '';
  const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"],legend')].filter(visible).map(text).filter(Boolean);
  const candidate = headings.find(t => t.includes('?')) || headings[0] || '';
  const controls = [...document.querySelectorAll('input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]')].filter(el => visible(el) || (el.labels && [...el.labels].some(visible))).filter(el => !el.parentElement?.closest('[role="radio"],[role="checkbox"]'));
  const label = el => {
    const linked = el.labels && [...el.labels].map(text).join(' ');
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => text(document.getElementById(id))).filter(Boolean).join(' ');
    return linked || el.getAttribute('aria-label') || labelled || text(el.closest('label')) || text(el);
  };
  const choices = controls.map(el => label(el).trim().replace(/\s+/g, ' '));
  const fields = [...document.querySelectorAll('textarea,input[type="text"],input:not([type])')].filter(el => visible(el) && !el.disabled && !el.readOnly);
  const joinField = fields.some(el => /\b(?:join(?:ing)?[ _-]*code|(?:enter|digit|access|presentation)[ _-]*(?:the[ _-]*)?(?:code|pin)|nickname|your[ _-]*name|search)\b/i.test([el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.name,el.id].filter(Boolean).join(' ')));
  const waiting = /^(enter.*code|join\b|waiting\b|wait\b|thank you\b|thanks\b|voting.*closed|results\b|get ready\b)/i.test(candidate);
  const question = !waiting && !joinField && (choices.length || fields.length === 1) ? candidate : '';
  const fingerprint = JSON.stringify({question, choices});
  if (action === 'read') {
    window.__mintiState.snapshot = {question, choices, fingerprint};
    window.__mintiState.dirty = false;
    return window.__mintiState.snapshot;
  }
  if (fingerprint !== payload.fingerprint) throw new Error('The question changed. Read it and ask AI again.');
  if (choices.length) {
    if (controls.some(el => el.type === 'checkbox' || el.getAttribute('role') === 'checkbox')) throw new Error('Multiple-answer questions need manual selection.');
    const matches = controls.filter((el, i) => choices[i].toLowerCase() === payload.answer.trim().toLowerCase());
    if (matches.length !== 1) throw new Error('No unique matching choice found. Select the answer manually.');
    if (matches[0].disabled || matches[0].getAttribute('aria-disabled') === 'true') throw new Error('The answer control is disabled.');
    if (!matches[0].checked && matches[0].getAttribute('aria-checked') !== 'true') matches[0].click();
    return 'Selected the matching choice. Check whether the page requires Submit.';
  }
  if (!question) throw new Error('No answerable question is visible.');
  if (fields.length !== 1) throw new Error('No unique text answer field found. Copy the answer manually.');
  const field = fields[0];
  const proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, payload.answer);
  field.dispatchEvent(new Event('input', {bubbles:true}));
  field.dispatchEvent(new Event('change', {bubbles:true}));
  return 'Filled the answer. Review it and submit on the page.';
}
