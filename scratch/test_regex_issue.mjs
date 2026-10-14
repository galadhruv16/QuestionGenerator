const fullText = `
particular Page, Its Job Is To Retrieve The Page From The server.
\u2327 Event-based Refers To Javascript's Ability To Run Certain functions.
As we will see how we can use this to write the current code.
- (win_width/2)
- (win_height/2)
- The words "please try again" are displayed in the
`;

const oldHeadingRegex =
  /(?:^|\n)(?:#{1,3}\s+|(?:\d+\.?\s+)?(?:chapter|unit|section|part)\s*[:\s\d.]*)\s*([^\n\r.]+)/gi;

console.log('--- OLD REGEX MATCHES ---');
for (const m of fullText.matchAll(oldHeadingRegex)) {
  console.log('Matched text:', JSON.stringify(m[0]));
  console.log('Group 1:', JSON.stringify(m[1]));
}
