import { config, collection, singleton, fields } from '@keystatic/core'

export default config({
  storage:
    process.env.NODE_ENV === 'production'
      ? { kind: 'cloud' }
      : { kind: 'local' },

  cloud: {
    project: 'albert-dieckmann/albert-cv',
  },

  ui: {
    brand: {
      name: 'albertdieckmann.dk',
    },
  },

  singletons: {
    hero: singleton({
      label: '🏠 Forside – hero',
      path: 'content/hero',
      format: { data: 'yaml' },
      schema: {
        tag: fields.text({ label: 'Topbanner (f.eks. "Tilgængelig for nye projekter")' }),
        description: fields.text({ label: 'Beskrivelse under navn', multiline: true }),
        ctaText: fields.text({ label: 'Knaptekst' }),
        stats: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            value: fields.text({ label: 'Værdi' }),
          }),
          { label: 'Faktaboks (højre side)', itemLabel: (props) => props.fields.label.value }
        ),
      },
    }),

    about: singleton({
      label: '👤 Om mig',
      path: 'content/about',
      format: { data: 'yaml' },
      schema: {
        paragraph1: fields.text({ label: 'Afsnit 1', multiline: true }),
        paragraph2: fields.text({ label: 'Afsnit 2', multiline: true }),
        paragraph3: fields.text({ label: 'Afsnit 3', multiline: true }),
        items: fields.array(
          fields.object({
            icon: fields.text({ label: 'Ikon (emoji eller tal)' }),
            title: fields.text({ label: 'Titel' }),
            description: fields.text({ label: 'Beskrivelse' }),
          }),
          { label: 'Punkter (højre side)', itemLabel: (props) => props.fields.title.value }
        ),
      },
    }),

    skills: singleton({
      label: '🧠 Kompetencer',
      path: 'content/skills',
      format: { data: 'yaml' },
      schema: {
        chips: fields.array(
          fields.object({
            name: fields.text({ label: 'Kompetence' }),
            category: fields.text({ label: 'Kategori' }),
          }),
          { label: 'Kompetencer', itemLabel: (props) => props.fields.name.value }
        ),
        roskildeTitle: fields.text({ label: 'Roskilde – titel' }),
        roskildeSubtitle: fields.text({ label: 'Roskilde – undertitel' }),
        roskildeBadge: fields.text({ label: 'Roskilde – badge' }),
      },
    }),

    contact: singleton({
      label: '✉️ Kontakt',
      path: 'content/contact',
      format: { data: 'yaml' },
      schema: {
        heading: fields.text({ label: 'Overskrift' }),
        description: fields.text({ label: 'Beskrivelse', multiline: true }),
        linkedinUrl: fields.text({ label: 'LinkedIn URL' }),
        email: fields.text({ label: 'Email' }),
      },
    }),
  },

  collections: {
    experience: collection({
      label: '💼 Erfaring',
      path: 'content/experience/*',
      format: { data: 'yaml' },
      slugField: 'title',
      schema: {
        period: fields.text({ label: 'Periode (Nu / Tidligere / Frivillig)' }),
        org: fields.text({ label: 'Organisation' }),
        title: fields.text({ label: 'Jobtitel' }),
        description: fields.text({ label: 'Beskrivelse', multiline: true }),
        order: fields.integer({ label: 'Rækkefølge (1 = øverst)' }),
      },
    }),
  },
})
