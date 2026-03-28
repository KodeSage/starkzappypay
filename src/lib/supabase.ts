import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface UsernameRecord {
  username: string
  address: string
  message: string
}

export type ValidationResult =
  | { ok: true; isUpdate: boolean }
  | { ok: false; error: string }

export async function validateUsernameAndAddress(
  username: string,
  address: string
): Promise<ValidationResult> {
  const lowerUsername = username.toLowerCase()
  const lowerAddress = address.toLowerCase()

  // Check if username already exists in db
  const { data: byUsername } = await supabase
    .from('usernames')
    .select('username, address')
    .eq('username', lowerUsername)
    .maybeSingle()

  if (byUsername) {
    if (byUsername.address.toLowerCase() !== lowerAddress) {
      return { ok: false, error: `@${username} is already taken by a different address.` }
    }
    // Same username + same address → they're updating their own record
    return { ok: true, isUpdate: true }
  }

  // Username is free — check if this address is already tied to another username
  const { data: byAddress } = await supabase
    .from('usernames')
    .select('username')
    .eq('address', address)
    .maybeSingle()

  if (byAddress) {
    return {
      ok: false,
      error: `This address is already registered as @${byAddress.username}. Use that username or a different address.`,
    }
  }

  return { ok: true, isUpdate: false }
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
