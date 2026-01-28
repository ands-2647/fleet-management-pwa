import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lqzqhgekzmvdweehlnap.supabase.co'
const supabaseAnonKey = 'sb_publishable_xho39K7sZrNUcD39_PTpgg_0sQBF9cm'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
