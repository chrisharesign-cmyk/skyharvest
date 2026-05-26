import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jfshgagcamougadyntzd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmc2hnYWdjYW1vdWdhZHludHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDEzNzEsImV4cCI6MjA5NTM3NzM3MX0.ea5scfPvwE61SCnQNkTHvC2MnPtCcZe5cxggafemUeQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('name')
  if (error) console.error('getCustomers:', error)
  return data || []
}

export async function getProducts() {
  const { data, error } = await supabase.from('products').select('*').eq('active', true).order('crop_family, name')
  if (error) console.error('getProducts:', error)
  return data || []
}

export async function getHarvestEvents(limit = 30) {
  const { data, error } = await supabase.from('harvest_events').select('*').order('date', { ascending: false }).limit(limit)
  if (error) console.error('getHarvestEvents:', error)
  return data || []
}

export async function getOrderLines(harvestEventId) {
  const { data, error } = await supabase
    .from('order_lines')
    .select('*, customer:customers(id,name), product:products(id,name,weight_g,crop_family)')
    .eq('harvest_event_id', harvestEventId)
    .gt('quantity', 0)
  if (error) console.error('getOrderLines:', error)
  return data || []
}

export async function upsertOrderLine(harvestEventId, customerId, productId, quantity) {
  const { data, error } = await supabase
    .from('order_lines')
    .upsert({ harvest_event_id: harvestEventId, customer_id: customerId, product_id: productId, quantity },
             { onConflict: 'harvest_event_id,customer_id,product_id' })
    .select()
  return { data, error }
}

export async function createHarvestEvent(date, dayOfWeek) {
  const { data, error } = await supabase
    .from('harvest_events')
    .insert({ date, day_of_week: dayOfWeek, status: 'draft' })
    .select().single()
  return { data, error }
}

export async function updateHarvestEventStatus(id, status) {
  return await supabase.from('harvest_events').update({ status }).eq('id', id)
}

export async function getPlantings() {
  const { data, error } = await supabase.from('plantings').select('*').order('planted_at', { ascending: false })
  if (error) console.error('getPlantings:', error)
  return data || []
}

export async function getPlantingByBarcode(barcodeId) {
  const { data, error } = await supabase.from('plantings').select('*, tray_health(*)').eq('barcode_id', barcodeId).single()
  if (error) console.error('getPlantingByBarcode:', error)
  return data
}

export async function createPlanting(planting) {
  return await supabase.from('plantings').insert(planting).select().single()
}

export async function getStaff() {
  const { data, error } = await supabase.from('staff').select('*').eq('active', true).order('name')
  if (error) console.error('getStaff:', error)
  return data || []
}
