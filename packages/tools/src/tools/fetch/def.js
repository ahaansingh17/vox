export const definition = {
  name: 'fetch_webpage',
  readOnly: true,
  description:
    'Fetch a webpage and extract its text content. Use after web_search to read a specific result, or when the user provides a URL.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch.' }
    },
    required: ['url']
  }
}
