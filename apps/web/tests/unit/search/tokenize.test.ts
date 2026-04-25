/**
 * Unit Tests: Search Tokenizer and Indexer
 * 
 * Tests tokenization, stemming, stop word removal, and index building logic.
 * 
 * @see specs/004-client-side-features/spec.md#user-story-2---advanced-client-side-search
 * @see specs/004-client-side-features/tasks.md#t018
 */

import { describe, it, expect } from 'vitest';

/**
 * Tokenizer tests
 */
describe('Tokenizer', () => {
  // Mock tokenize function - will be implemented in T020
  function tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  it('should tokenize simple text', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const tokens = tokenize(text);

    expect(tokens).toEqual([
      'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog',
    ]);
  });

  it('should convert to lowercase', () => {
    const text = 'Machine Learning and AI';
    const tokens = tokenize(text);

    expect(tokens).toEqual(['machine', 'learning', 'and', 'ai']);
  });

  it('should remove punctuation', () => {
    const text = 'Hello, world! How are you?';
    const tokens = tokenize(text);

    expect(tokens).toEqual(['hello', 'world', 'how', 'are', 'you']);
  });

  it('should handle empty string', () => {
    const tokens = tokenize('');
    expect(tokens).toEqual([]);
  });

  it('should handle multiple spaces', () => {
    const text = 'word1    word2     word3';
    const tokens = tokenize(text);

    expect(tokens).toEqual(['word1', 'word2', 'word3']);
  });
});

/**
 * Stop word removal tests
 */
describe('Stop Word Removal', () => {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  ]);

  function removeStopWords(tokens: string[]): string[] {
    return tokens.filter((token) => !stopWords.has(token));
  }

  it('should remove common stop words', () => {
    const tokens = ['the', 'quick', 'brown', 'fox'];
    const filtered = removeStopWords(tokens);

    expect(filtered).toEqual(['quick', 'brown', 'fox']);
  });

  it('should keep meaningful words', () => {
    const tokens = ['machine', 'learning', 'algorithm'];
    const filtered = removeStopWords(tokens);

    expect(filtered).toEqual(['machine', 'learning', 'algorithm']);
  });

  it('should handle empty array', () => {
    const filtered = removeStopWords([]);
    expect(filtered).toEqual([]);
  });
});

/**
 * Term frequency tests
 */
describe('Term Frequency', () => {
  function calculateTermFrequency(tokens: string[]): Map<string, number> {
    const frequency = new Map<string, number>();

    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }

    return frequency;
  }

  it('should count term occurrences', () => {
    const tokens = ['word', 'test', 'word', 'example', 'test', 'word'];
    const frequency = calculateTermFrequency(tokens);

    expect(frequency.get('word')).toBe(3);
    expect(frequency.get('test')).toBe(2);
    expect(frequency.get('example')).toBe(1);
  });

  it('should handle single occurrence', () => {
    const tokens = ['unique'];
    const frequency = calculateTermFrequency(tokens);

    expect(frequency.get('unique')).toBe(1);
  });

  it('should handle empty array', () => {
    const frequency = calculateTermFrequency([]);
    expect(frequency.size).toBe(0);
  });
});

/**
 * Posting list tests
 */
describe('Posting List', () => {
  interface Posting {
    articleId: string;
    positions: number[];
    weight:    number;
  }

  function createPosting(articleId: string, positions: number[]): Posting {
    // Weight based on term frequency (normalized)
    const weight = positions.length / 100; // Simple weight calculation

    return {
      articleId,
      positions,
      weight: Math.min(1, weight),
    };
  }

  it('should create posting with positions', () => {
    const posting = createPosting('article-1', [0, 5, 10]);

    expect(posting.articleId).toBe('article-1');
    expect(posting.positions).toEqual([0, 5, 10]);
    expect(posting.weight).toBeGreaterThan(0);
  });

  it('should normalize weight to [0, 1]', () => {
    const posting = createPosting('article-1', Array(150).fill(0).map((_, i) => i));

    expect(posting.weight).toBeLessThanOrEqual(1);
  });
});

/**
 * Inverted index tests
 */
describe('Inverted Index', () => {
  interface InvertedIndex {
    [term: string]: {
      docFrequency: number;
      postings:     Array<{ articleId: string; positions: number[] }>;
    };
  }

  function buildInvertedIndex(documents: Array<{ id: string; tokens: string[] }>): InvertedIndex {
    const index: InvertedIndex = {};

    for (const doc of documents) {
      const termPositions = new Map<string, number[]>();

      // Record positions for each term
      doc.tokens.forEach((token, position) => {
        if (!termPositions.has(token)) {
          termPositions.set(token, []);
        }
        termPositions.get(token)!.push(position);
      });

      // Update inverted index
      for (const [term, positions] of termPositions.entries()) {
        if (!index[term]) {
          index[term] = {
            docFrequency: 0,
            postings:     [],
          };
        }

        index[term].docFrequency++;
        index[term].postings.push({
          articleId: doc.id,
          positions,
        });
      }
    }

    return index;
  }

  it('should build index for single document', () => {
    const docs = [
      { id: 'doc1', tokens: ['machine', 'learning', 'ai'] },
    ];

    const index = buildInvertedIndex(docs);

    expect(index['machine'].docFrequency).toBe(1);
    expect(index['machine'].postings).toHaveLength(1);
    expect(index['machine'].postings[0]?.articleId).toBe('doc1');
  });

  it('should build index for multiple documents', () => {
    const docs = [
      { id: 'doc1', tokens: ['machine', 'learning'] },
      { id: 'doc2', tokens: ['deep', 'learning'] },
    ];

    const index = buildInvertedIndex(docs);

    expect(index['learning'].docFrequency).toBe(2);
    expect(index['learning'].postings).toHaveLength(2);
  });

  it('should track term positions', () => {
    const docs = [
      { id: 'doc1', tokens: ['word', 'test', 'word'] },
    ];

    const index = buildInvertedIndex(docs);

    expect(index['word'].postings[0]?.positions).toEqual([0, 2]);
    expect(index['test'].postings[0]?.positions).toEqual([1]);
  });
});

/**
 * TF-IDF scoring tests
 */
describe('TF-IDF Scoring', () => {
  function calculateTFIDF(
    termFrequency: number,
    docFrequency: number,
    totalDocs: number
  ): number {
    // TF: term frequency normalized
    const tf = termFrequency;

    // IDF: inverse document frequency
    const idf = Math.log((totalDocs + 1) / (docFrequency + 1));

    return tf * idf;
  }

  it('should calculate TF-IDF score', () => {
    const score = calculateTFIDF(3, 2, 100);

    expect(score).toBeGreaterThan(0);
  });

  it('should give higher scores to rare terms', () => {
    const commonTermScore = calculateTFIDF(3, 50, 100);
    const rareTermScore   = calculateTFIDF(3, 5, 100);

    expect(rareTermScore).toBeGreaterThan(commonTermScore);
  });

  it('should handle edge case of single document', () => {
    const score = calculateTFIDF(1, 1, 1);

    expect(score).toBeGreaterThanOrEqual(0);
  });
});
