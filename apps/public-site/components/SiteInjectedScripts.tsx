'use client';

import { useEffect } from 'react';

interface SiteInjectedScriptsProps {
  headHtml?: string;
  bodyStartHtml?: string;
  bodyEndHtml?: string;
}

function injectHtml(target: HTMLElement, html: string, marker: string) {
  if (!html?.trim()) return;
  if (document.getElementById(marker)) return;

  const container = document.createElement('div');
  container.id = marker;
  container.innerHTML = html;
  const nodes = Array.from(container.childNodes);
  for (const node of nodes) {
    target.appendChild(node);
  }
}

export function SiteInjectedScripts({
  headHtml,
  bodyStartHtml,
  bodyEndHtml,
}: SiteInjectedScriptsProps) {
  useEffect(() => {
    injectHtml(document.head, headHtml ?? '', 'aicw-custom-head');
  }, [headHtml]);

  useEffect(() => {
    injectHtml(document.body, bodyStartHtml ?? '', 'aicw-custom-body-start');
  }, [bodyStartHtml]);

  useEffect(() => {
    injectHtml(document.body, bodyEndHtml ?? '', 'aicw-custom-body-end');
  }, [bodyEndHtml]);

  return null;
}
