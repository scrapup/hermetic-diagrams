import { describe, expect, it } from 'vitest';
import { extractExamples } from './guide-examples.js';

const block = (info: string, body: string): string => ['```' + info, body, '```'].join('\n');

describe('extractExamples', () => {
  it('extracts hermetic-example blocks with format, output, source and line', () => {
    const md = ['# T', '', block('hermetic-example format=plantuml output=svg', '@startuml\nA -> B\n@enduml'), '', block('hermetic-example output=png format=c4', 'X')].join('\n');
    expect(extractExamples(md)).toEqual([
      { format: 'plantuml', output: 'svg', source: '@startuml\nA -> B\n@enduml', line: 3 },
      { format: 'c4', output: 'png', source: 'X', line: 9 },
    ]);
  });

  it('ignores other fenced blocks', () => {
    expect(extractExamples([block('plantuml', 'X'), block('', 'Y')].join('\n'))).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    expect(extractExamples('```hermetic-example format=d2 output=svg\r\na -> b\r\n```')).toEqual([
      { format: 'd2', output: 'svg', source: 'a -> b', line: 1 },
    ]);
  });

  it.each([
    ['hermetic-example format=plantuml output=svg theme=x', /unknown attribute "theme"/],
    ['hermetic-example format=plantuml format=c4 output=svg', /duplicated attribute "format"/],
    ['hermetic-example output=svg', /missing or unknown format/],
    ['hermetic-example format=mermaid output=svg', /missing or unknown format/],
    ['hermetic-example format=plantuml', /missing or unknown output/],
    ['hermetic-example format=plantuml output=pdf', /missing or unknown output/],
    ['hermetic-example format="plantuml" output=svg', /malformed attribute/],
    ['hermetic-examples format=plantuml output=svg', /malformed info string/],
  ])('rejects the info string %j', (info, error) => {
    expect(() => extractExamples(block(info, 'X'))).toThrow(error);
  });

  it('rejects an unterminated block', () => {
    expect(() => extractExamples('```hermetic-example format=plantuml output=svg\n@startuml')).toThrow(/unterminated/);
  });
});
