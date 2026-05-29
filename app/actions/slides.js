'use server'

import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'

const sql = neon(process.env.DATABASE_URL)

export async function addMessage(formData) {
  const title = formData.get('title')
  const body = formData.get('body')
  
  await sql`
    INSERT INTO rf_slides (type, title, body, active, weight)
    VALUES ('message', ${title}, ${body}, true, 1)
  `
  revalidatePath('/rf-admin')
}

export async function toggleSlide(id, active) {
  await sql`
    UPDATE rf_slides SET active = ${active} WHERE id = ${id}
  `
  revalidatePath('/rf-admin')
}

export async function updateWeight(id, weight) {
  await sql`
    UPDATE rf_slides SET weight = ${weight} WHERE id = ${id}
  `
  revalidatePath('/rf-admin')
}

export async function deleteSlide(id) {
  await sql`DELETE FROM rf_slides WHERE id = ${id}`
  revalidatePath('/rf-admin')
}

