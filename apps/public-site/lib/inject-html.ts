/**
 * Inject arbitrary HTML into the page. Recreates <script> nodes so they execute
 * (innerHTML / dangerouslySetInnerHTML do not run scripts).
 */
export function injectCustomHtml(
  target: HTMLElement,
  html: string,
  marker: string,
  position: 'append' | 'prepend' = 'append',
): void {
  const trimmed = html?.trim();
  if (!trimmed) return;

  target.querySelectorAll(`[data-aicw-marker="${marker}"]`).forEach((el) => el.remove());

  const template = document.createElement('template');
  template.innerHTML = trimmed;

  for (const node of Array.from(template.content.childNodes)) {
    mountNode(target, node, marker, position);
  }
}

function mountNode(
  target: HTMLElement,
  node: Node,
  marker: string,
  position: 'append' | 'prepend',
): void {
  if (node.nodeName === 'SCRIPT') {
    insertNode(target, createExecutableScript(node as HTMLScriptElement, marker), position);
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    element.querySelectorAll('script').forEach((oldScript) => {
      oldScript.replaceWith(createExecutableScript(oldScript, marker));
    });
    element.setAttribute('data-aicw-marker', marker);
    insertNode(target, element, position);
    return;
  }

  if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-aicw-marker', marker);
    wrapper.appendChild(node.cloneNode(true));
    insertNode(target, wrapper, position);
  }
}

function createExecutableScript(
  oldScript: HTMLScriptElement,
  marker: string,
): HTMLScriptElement {
  const script = document.createElement('script');
  for (const attr of Array.from(oldScript.attributes)) {
    script.setAttribute(attr.name, attr.value);
  }
  script.textContent = oldScript.textContent;
  script.setAttribute('data-aicw-marker', marker);
  return script;
}

function insertNode(
  target: HTMLElement,
  node: Node,
  position: 'append' | 'prepend',
): void {
  if (position === 'prepend') {
    target.insertBefore(node, target.firstChild);
    return;
  }
  target.appendChild(node);
}
