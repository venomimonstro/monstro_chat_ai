/**
 * robots-parser is CJS (`module.exports = fn`). Default import breaks at runtime:
 * `(0 , robots_parser_1.default) is not a function`
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const robotsParserFn = require('robots-parser') as (
  url: string,
  contents: string,
) => RobotsParserInstance;

export interface RobotsParserInstance {
  isAllowed: (url: string, ua?: string) => boolean | undefined;
  getSitemaps?: () => string[];
}

export function parseRobots(
  url: string,
  contents: string,
): RobotsParserInstance {
  return robotsParserFn(url, contents);
}
