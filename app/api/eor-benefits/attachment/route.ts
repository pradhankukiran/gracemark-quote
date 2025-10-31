import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileUrl = searchParams.get('url')

  if (!fileUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const response = await fetch(fileUrl)

    if (!response.ok) {
      const errorText = await response.text()
      return new NextResponse(errorText, {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/xml' },
      })
    }

    const headers = new Headers()
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/pdf')
    headers.set('Content-Disposition', `inline; filename="benefit-document.pdf"`)

    return new NextResponse(response.body, {
      status: 200,
      headers,
    })

  } catch (error) {
    console.error('Attachment proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
