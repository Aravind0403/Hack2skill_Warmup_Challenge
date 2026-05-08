import { describe, it, expect } from 'vitest';

describe('Trip Engine Core Logic', () => {
  it('should correctly parse vibes (Mock test)', () => {
    const query = "A spiritual trip to Thanjavur";
    const parseVibe = (q) => q.toLowerCase().includes('spiritual') ? 'spiritual' : 'adventure';
    
    expect(parseVibe(query)).toBe('spiritual');
  });

  it('should default to adventure for unknown vibes', () => {
    const query = "A normal trip";
    const parseVibe = (q) => q.toLowerCase().includes('spiritual') ? 'spiritual' : 'adventure';
    
    expect(parseVibe(query)).toBe('adventure');
  });
});
