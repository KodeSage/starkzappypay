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
  | { ok: true; isNew: boolean }
  | { ok: false; existingUsername: string; reason: string }

export async function validateUsernameAndAddress(
  username: string,
  address: string
): Promise<ValidationResult> {
  const lowerUsername = username.toLowerCase()
  const lowerAddress = address.toLowerCase()

  // Check if username already exists
  const { data: byUsername } = await supabase
    .from('usernames')
    .select('username, address')
    .eq('username', lowerUsername)
    .maybeSingle()

  if (byUsername) {
    if (byUsername.address.toLowerCase() !== lowerAddress) {
      // Username taken by a different address — surface the existing link
      return { ok: false, existingUsername: byUsername.username, reason: 'username_taken' }
    }
    // Same username + same address — returning user
    return { ok: true, isNew: false }
  }

  // Username is free — check if address is already tied to another username
  const { data: byAddress } = await supabase
    .from('usernames')
    .select('username')
    .eq('address', address)
    .maybeSingle()

  if (byAddress) {
    return { ok: false, existingUsername: byAddress.username, reason: 'address_taken' }
  }

  return { ok: true, isNew: true }
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

export async function resolveAddress(address: string): Promise<UsernameRecord | null> {
  const { data, error } = await supabase
    .from('usernames')
    .select('username, address, message')
    .eq('address', address)
    .single()
  if (error || !data) return null
  return data as UsernameRecord
}
