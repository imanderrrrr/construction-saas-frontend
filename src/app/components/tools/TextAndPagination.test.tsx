import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n';
import { RecordPagination } from '../ui/record-pagination';
import { TextValue } from './TextValue';
import { click, type } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let node: HTMLDivElement;
let root: Root;
beforeEach(() => { node = document.createElement('div'); document.body.append(node); root = createRoot(node); });
afterEach(() => { act(() => root.unmount()); node.remove(); });
describe('history navigation', () => {
  it('has a constant number of controls and a keyboard-submit jump across 10000 pages', () => {
    const go = vi.fn();
    act(() => root.render(<RecordPagination current={1} total={10000} onPage={go} />));
    expect(node.querySelectorAll('button')).toHaveLength(3);
    expect(node.querySelector('button')!.disabled).toBe(true);
    const input = node.querySelector('input')!;
    expect(node.querySelector('label')!.htmlFor).toBe(input.id);
    type(input, '10000');
    act(() => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(go).toHaveBeenLastCalledWith(10000);
    type(input, '10001');
    act(() => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(go).toHaveBeenCalledTimes(1);
  });
  it('keeps next and previous semantics at the end', () => {
    const go = vi.fn();
    act(() => root.render(<RecordPagination current={27} total={27} onPage={go} />));
    const buttons = node.querySelectorAll('button');
    expect(buttons[2].disabled).toBe(true);
    click(buttons[0]);
    expect(go).toHaveBeenCalledWith(26);
  });
});
it.each(['T'.repeat(200), 'N'.repeat(500), '👷🏽‍♀️'.repeat(500), 'texto con espacios '.repeat(500)])('preserves an adversarial value in a native full-text disclosure', value => {
  act(() => root.render(<TextValue value={value} className="" />));
  expect(node.querySelector('summary')!.textContent).not.toContain(value);
  expect(node.querySelector('summary')!.textContent).toContain('…');
  expect(node.querySelector('details > [role=region]')!.textContent).toBe(value);
  click(node.querySelector('summary'));
  expect(node.querySelector('details')!.open).toBe(true);
});
