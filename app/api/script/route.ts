export const runtime = 'edge'
export async function GET() {
  return new Response('Categories migration completed', { status: 200 })
}
