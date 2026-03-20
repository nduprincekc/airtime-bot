export async function GET() {
  try {
    const supabase = await import('@supabase/supabase-js')
    return new Response("Supabase FOUND ✅")
  } catch (err) {
    return new Response("Supabase NOT FOUND ❌")
  }
}