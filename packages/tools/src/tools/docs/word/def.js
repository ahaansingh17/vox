export const WORD_TOOL_DEFINITIONS = [
  {
    name: 'create_word_document',
    description:
      "Create or overwrite a styled Microsoft Word .docx file on the user's local machine using structured blocks and theme options. Supports append mode for multi-step updates to an existing document. Do not call with path only; include title/content/blocks.",
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Target .docx path. Supports absolute paths and ~/ shortcuts. If no extension is provided, .docx is appended.'
        },
        filePath: {
          type: 'string',
          description: 'Alias of path.'
        },
        targetPath: {
          type: 'string',
          description: 'Alias of path.'
        },
        directory: {
          type: 'string',
          description: 'Optional output directory used with filename when path is not set.'
        },
        filename: {
          type: 'string',
          description: 'Optional output filename used with directory when path is not set.'
        },
        title: {
          type: 'string',
          description: 'Optional document title inserted as Heading 1.'
        },
        content: {
          type: 'string',
          description:
            'Document body as plain text. New lines become paragraphs. Aliases body/text/markdown are also accepted.'
        },
        body: {
          type: 'string',
          description: 'Alias of content.'
        },
        text: {
          type: 'string',
          description: 'Alias of content.'
        },
        markdown: {
          type: 'string',
          description: 'Alias of content.'
        },
        blocks: {
          type: 'array',
          description:
            'Optional structured blocks for detailed formatting. Prefer this over plain content for fine styling control.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Block kind: heading, paragraph, bullet, quote, or separator.'
              },
              text: {
                type: 'string',
                description: 'Main text for heading/paragraph/quote/bullet.'
              },
              items: {
                type: 'array',
                description: 'Optional bullet items. Used when type is bullet.',
                items: {
                  type: 'string'
                }
              },
              level: {
                type: 'integer',
                description: 'Heading or bullet depth level (1-4).'
              },
              style: {
                type: 'object',
                description: 'Per-block style overrides.',
                properties: {
                  size: {
                    type: 'number',
                    description: 'Font size in points.'
                  },
                  color: {
                    type: 'string',
                    description: 'Hex color like #DB2777.'
                  },
                  bold: {
                    type: 'boolean',
                    description: 'Enable bold text.'
                  },
                  italic: {
                    type: 'boolean',
                    description: 'Enable italic text.'
                  },
                  align: {
                    type: 'string',
                    description: 'Text alignment: left, center, right, justify.'
                  },
                  indent: {
                    type: 'integer',
                    description: 'Left indent amount.'
                  },
                  spacingBefore: {
                    type: 'number',
                    description: 'Spacing before the block in points.'
                  },
                  spacingAfter: {
                    type: 'number',
                    description: 'Spacing after the block in points.'
                  }
                }
              }
            }
          }
        },
        theme: {
          type: 'object',
          description: 'Optional document-wide defaults.',
          properties: {
            titleColor: {
              type: 'string',
              description: 'Title color (hex).'
            },
            headingColor: {
              type: 'string',
              description: 'Heading color (hex).'
            },
            textColor: {
              type: 'string',
              description: 'Body text color (hex).'
            },
            quoteColor: {
              type: 'string',
              description: 'Quote text color (hex).'
            },
            titleSize: {
              type: 'number',
              description: 'Title size in points.'
            },
            headingSizes: {
              type: 'array',
              description: 'Heading sizes for levels 1-4 in points.',
              items: {
                type: 'number'
              }
            },
            bodySize: {
              type: 'number',
              description: 'Body font size in points.'
            },
            align: {
              type: 'string',
              description: 'Default alignment: left, center, right, justify.'
            }
          }
        },
        append: {
          type: 'boolean',
          description:
            'When true, preserves existing .docx text (if file exists) and appends new content before rewriting the document. Use this for sequential worker steps.'
        },
        createParents: {
          type: 'boolean',
          description: 'Create missing parent directories automatically. Defaults to true.'
        }
      },
      required: ['path']
    }
  }
]
