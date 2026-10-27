import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { language } = vi.hoisted(() => ({ language: { current: 'es' } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: language.current, resolvedLanguage: language.current },
  }),
}));

import { Testimonials } from './Testimonials';
import { TESTIMONIALS, type Testimonial } from './testimonialsData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Fixture for the test only — never shipped. The real list is
// `testimonialsData.ts`, and it holds real customers or nothing.
const SAMPLE: Testimonial = {
  name: 'Test Person',
  role: { es: 'Gerente de obra', en: 'Site manager' },
  company: 'Test Co',
  quote: { es: 'Frase en español', en: 'Sentence in English' },
  result: { es: 'Resultado', en: 'Result' },
  photo: '/testimonials/test.jpg',
};

describe('Testimonials', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    language.current = 'es';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('ships with no testimonial: nothing is published until a real one is added', () => {
    expect(TESTIMONIALS).toEqual([]);
  });

  it('renders nothing while the list is empty', async () => {
    await act(async () => root.render(<Testimonials items={[]} />));
    expect(container.innerHTML).toBe('');
  });

  it('shows the quote, the person and the result in the page language', async () => {
    await act(async () => root.render(<Testimonials items={[SAMPLE]} />));
    expect(container.querySelector('#testimonios')).not.toBeNull();
    expect(container.querySelector('blockquote')?.textContent).toContain('Frase en español');
    const caption = container.querySelector('figcaption')!.textContent;
    expect(caption).toContain('Test Person');
    expect(caption).toContain('Gerente de obra · Test Co');
    expect(container.textContent).toContain('RESULTADO');

    act(() => root.unmount());
    root = createRoot(container);
    language.current = 'en-US';
    await act(async () => root.render(<Testimonials items={[SAMPLE]} />));
    expect(container.querySelector('blockquote')?.textContent).toContain('Sentence in English');
  });
});
