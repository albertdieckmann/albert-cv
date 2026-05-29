import Link from 'next/link'

export default function Home() {
  return (
    <main style={{padding: '2rem', fontFamily: 'sans-serif'}}>
      <h1>RF Pressecenter</h1>
      <p><Link href="/rf-screen">Infoskærm</Link></p>
      <p><Link href="/rf-admin">Admin</Link></p>
    </main>
  )
}
