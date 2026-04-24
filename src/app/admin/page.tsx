import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import AdminClient from './AdminClient'

function readYaml<T>(file: string): T {
  return yaml.load(readFileSync(join(process.cwd(), 'content', file), 'utf8')) as T
}

interface StatItem {
  label: string
  value: string
}

interface HeroData {
  tag: string
  description: string
  ctaText: string
  stats: StatItem[]
}

interface AboutItem {
  icon: string
  title: string
  description: string
}

interface AboutData {
  paragraph1: string
  paragraph2: string
  paragraph3: string
  items: AboutItem[]
}

interface ChipItem {
  name: string
  category: string
}

interface SkillsData {
  chips: ChipItem[]
}

interface ContactData {
  heading: string
  description: string
  linkedinUrl: string
  email: string
}

interface ExpEntry {
  period: string
  org: string
  title: string
  description: string
  order?: number
  slug: string
}

interface GalleryImage { filename: string; caption: string; order?: number }
interface GalleryData { images: GalleryImage[] }

interface ProjectItem { title: string; description: string; href: string; tags?: string; live?: boolean; order?: number }
interface ProjectsData { projects: ProjectItem[] }

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const hero = readYaml<HeroData>('hero.yaml')
  const about = readYaml<AboutData>('about.yaml')
  const skills = readYaml<SkillsData>('skills.yaml')
  const contact = readYaml<ContactData>('contact.yaml')

  const expFiles = readdirSync(join(process.cwd(), 'content', 'experience'))
  const experiences: ExpEntry[] = expFiles
    .map(f => {
      const entry = readYaml<Omit<ExpEntry, 'slug'>>('experience/' + f)
      return { ...entry, slug: f.replace('.yaml', '') }
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const gallery = readYaml<GalleryData>('gallery.yaml')
  const projectsData = readYaml<ProjectsData>('projects.yaml')

  return (
    <AdminClient
      hero={hero}
      about={about}
      skills={skills}
      contact={contact}
      experiences={experiences}
      gallery={gallery}
      projects={projectsData?.projects ?? []}
    />
  )
}
