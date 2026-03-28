import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface UsernameRecord {
  username: string
  address: string
  message: string
  preferred_token?: string
  goal_amount?: number | null
  goal_label?: string
}

export interface TipRecord {
  id?: string
  recipient_username: string
  tipper_name: string
  tipper_message: string
  amount: string
  token: string
  tx_hash: string
  created_at?: string
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

  const { data: byUsername } = await supabase
    .from('usernames')
    .select('username, address')
    .eq('username', lowerUsername)
    .maybeSingle()

  if (byUsername) {
    if (byUsername.address.toLowerCase() !== lowerAddress) {
      return { ok: false, existingUsername: byUsername.username, reason: 'username_taken' }
    }
    return { ok: true, isNew: false }
  }

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
    .select('username, address, message, preferred_token, goal_amount, goal_label')
    .eq('username', username.toLowerCase())
    .single()
  if (error || !data) return null
  return data as UsernameRecord
}

export async function resolveAddress(address: string): Promise<UsernameRecord | null> {
  const { data, error } = await supabase
    .from('usernames')
    .select('username, address, message, preferred_token, goal_amount, goal_label')
    .eq('address', address)
    .single()
  if (error || !data) return null
  return data as UsernameRecord
}

export async function logTip(tip: Omit<TipRecord, 'id' | 'created_at'>): Promise<void> {
  await supabase.from('tips').insert(tip)
}

export async function getTips(recipient_username: string): Promise<TipRecord[]> {
  const { data } = await supabase
    .from('tips')
    .select('*')
    .eq('recipient_username', recipient_username.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(10)
  return (data as TipRecord[]) ?? []
}

export async function getGoalProgress(
  recipient_username: string,
  preferred_token: string
): Promise<number> {
  const { data } = await supabase
    .from('tips')
    .select('amount')
    .eq('recipient_username', recipient_username.toLowerCase())
    .eq('token', preferred_token)
  if (!data) return 0
  return data.reduce((sum, row) => sum + parseFloat(row.amount || '0'), 0)
}
