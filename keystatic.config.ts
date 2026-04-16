import { config, collection, singleton, fields } from '@keystatic/core'

export default config({
  storage:
    process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG
      ? { kind: 'github', repo: 'albertdieckmann/albert-cv' }
      : { kind: 'local' },

  singletons: {
    hero: singleton({
      label: 'Hero',
      path: 'content/hero',
      format: { data: 'yaml' },
      schema: {
        tag: fields.text({ label: 'Tag' }),
        description: fields.text({ label: 'Description', multiline: true }),
        ctaText: fields.text({ label: 'CTA Text' }),
        stats: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            value: fields.text({ label: 'Value' }),
          }),
          { label: 'Stats', itemLabel: (props) => props.fields.label.value }
        ),
      },
    }),

    about: singleton({
      label: 'About',
      path: 'content/about',
      format: { data: 'yaml' },
      schema: {
        paragraph1: fields.text({ label: 'Paragraph 1', multiline: true }),
        paragraph2: fields.text({ label: 'Paragraph 2', multiline: true }),
        paragraph3: fields.text({ label: 'Paragraph 3', multiline: true }),
        items: fields.array(
          fields.object({
            icon: fields.text({ label: 'Icon' }),
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description' }),
          }),
          { label: 'Items', itemLabel: (props) => props.fields.title.value }
        ),
      },
    }),

    skills: singleton({
      label: 'Skills',
      path: 'content/skills',
      format: { data: 'yaml' },
      schema: {
        chips: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            category: fields.text({ label: 'Category' }),
          }),
          { label: 'Chips', itemLabel: (props) => props.fields.name.value }
        ),
        roskildeTitle: fields.text({ label: 'Roskilde Title' }),
        roskildeSubtitle: fields.text({ label: 'Roskilde Subtitle' }),
        roskildeBadge: fields.text({ label: 'Roskilde Badge' }),
      },
    }),

    contact: singleton({
      label: 'Contact',
      path: 'content/contact',
      format: { data: 'yaml' },
      schema: {
        heading: fields.text({ label: 'Heading' }),
        description: fields.text({ label: 'Description', multiline: true }),
        linkedinUrl: fields.text({ label: 'LinkedIn URL' }),
        email: fields.text({ label: 'Email' }),
      },
    }),
  },

  collections: {
    experience: collection({
      label: 'Experience',
      path: 'content/experience/*',
      format: { data: 'yaml' },
      slugField: 'title',
      schema: {
        period: fields.text({ label: 'Period' }),
        org: fields.text({ label: 'Organisation' }),
        title: fields.text({ label: 'Title' }),
        description: fields.text({ label: 'Description', multiline: true }),
        order: fields.integer({ label: 'Order' }),
      },
    }),
  },
})
