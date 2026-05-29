import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { redirect } from 'next/navigation'
import { addMessage, toggleSlide, updateWeight, deleteSlide } from '../actions/slides'

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const sql = neon(process.env.DATABASE_URL)
  const slides = await sql`SELECT * FROM rf_slides ORDER BY id`

  const typeLabels = {
    weather: 'Vejr',
    program: 'Program',
    hours: 'Åbningstider',
    message: 'Meddelelse',
  }

  return (
    <main style={{padding: '2rem', fontFamily: 'sans-serif', maxWidth: '860px', margin: '0 auto'}}>
      <h1 style={{marginBottom: '0.25rem'}}>RF Pressecenter</h1>
      <p style={{color: '#666', marginBottom: '2rem'}}>Admin-panel</p>
      <h2 style={{marginBottom: '1rem'}}>Slides</h2>
      {slides.map(slide => (
        <div key={slide.id} style={{border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'}}>
          <div style={{flex: 1}}>
            <strong>{slide.title || typeLabels[slide.type] || slide.type}</strong>
            {slide.body && <p style={{margin: '0.25rem 0 0', color: '#555', fontSize: '0.9rem'}}>{slide.body}</p>}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <form action={updateWeight.bind(null, slide.id, Math.max(1, slide.weight - 1))}>
              <button style={{padding: '4px 10px', cursor: 'pointer'}}>minus</button>
            </form>
            <span style={{minWidth: '24px', textAlign: 'center'}}>{slide.weight}x</span>
            <form action={updateWeight.bind(null, slide.id, Math.min(5, slide.weight + 1))}>
              <button style={{padding: '4px 10px', cursor: 'pointer'}}>plus</button>
            </form>
            <form action={toggleSlide.bind(null, slide.id, !slide.active)}>
              <button style={{padding: '4px 12px', cursor: 'pointer', borderRadius: '4px', background: slide.active ? '#e8f5e9' : '#eee', border: '1px solid #ccc', color: slide.active ? 'green' : '#999'}}>
                {slide.active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </form>
            {slide.type === 'message' && (
              <form action={deleteSlide.bind(null, slide.id)}>
                <button style={{padding: '4px 10px', cursor: 'pointer', color: 'red', border: '1px solid #fcc', borderRadius: '4px', background: '#fff5f5'}}>Slet</button>
              </form>
            )}
          </div>
        </div>
      ))}
      <h2 style={{margin: '2rem 0 1rem'}}>Tilføj meddelelse</h2>
      <form action={addMessage} style={{border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', background: '#fafafa'}}>
        <div style={{marginBottom: '1rem'}}>
          <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Overskrift</label>
          <input name="title" style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem'}} placeholder="Fx: Pressemøde kl. 15:00" />
        </div>
        <div style={{marginBottom: '1rem'}}>
          <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Brodtekst</label>
          <textarea name="body" rows={3} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem'}} placeholder="Skriv besked til skaermen..." />
        </div>
        <button type="submit" style={{padding: '0.6rem 1.5rem', background: '#000', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem'}}>
          Send til skaerm
        </button>
      </form>
    </main>
  )
}
