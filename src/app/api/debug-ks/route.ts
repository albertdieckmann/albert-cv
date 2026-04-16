import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID
  const clientSecret = process.env.KEYSTATIC_GITHUB_CLIENT_SECRET
  const secret = process.env.KEYSTATIC_SECRET

  return NextResponse.json({
    hasClientId: !!clientId,
    clientIdPrefix: clientId?.slice(0, 8) ?? null,
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length ?? 0,
    hasSecret: !!secret,
  })
}
