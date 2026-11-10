import { describe, expect, it } from 'vitest';

import { stripHtml } from './text.js';

describe('stripHtml', () => {
  it('removes real tags', () => {
    expect(stripHtml('<p>Hi</p>')).toBe('Hi');
  });

  it('drops script and style blocks including their contents', () => {
    const input = '<p>Hi</p><script>alert(1)</script><style>p{color:red}</style>';
    expect(stripHtml(input)).toBe('Hi');
  });

  it('decodes entity-encoded markup before stripping', () => {
    expect(stripHtml('&lt;p&gt;x&lt;/p&gt;')).toBe('x');
  });

  it('decodes double-encoded entities', () => {
    expect(stripHtml('a&amp;nbsp;b')).toBe('a b');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('  a \n\n\t  b  ')).toBe('a b');
  });
});
