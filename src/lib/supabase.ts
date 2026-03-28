import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface UsernameRecord {
  username: string
  address: string
  message: string
}

export async function saveUsername(record: UsernameRecord): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('usernames')
    .upsert({ ...record, username: record.username.toLowerCase() }, { onConflict: 'username' })
  return { error: error ? error.message : null }
}

export async function resolveUsername(username: string): Promise<UsernameRecord | null> {
  const { data, error } = await supabase
    .from('usernames')
    .select('username, address, message')
    .eq('username', username.toLowerCase())
    .single()
  if (error || !data) return null
  return data as UsernameRecord
}
