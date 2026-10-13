// Event mode and follow-up reminders (browser client; RLS: owner only).
// Plan limits are enforced by database triggers, so these just surface
// their errors.

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cleanEventName } from "./followups";

export type EventRow = Tables<"events">;
export type ReminderRow = Tables<"contact_reminders"> & {
  contacts: { full_name: string; company: string | null } | null;
};

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Starts a new event; the database ends any event that was running. */
export async function startEvent(name: string, endsOn: string | null): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({ name: cleanEventName(name), ends_on: endsOn || null, is_active: true })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function endEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function setContactEvent(contactId: string, eventId: string | null): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({ event_id: eventId })
    .eq("id", contactId);
  if (error) throw error;
}

/** Open (not done) reminders, soonest first, with the contact's name. */
export async function listOpenReminders(): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from("contact_reminders")
    .select("*, contacts(full_name, company)")
    .is("done_at", null)
    .order("remind_at");
  if (error) throw error;
  return data as ReminderRow[];
}

export async function addReminders(
  contactIds: string[],
  remindAt: Date,
  note: string | null,
): Promise<void> {
  if (!contactIds.length) return;
  const { error } = await supabase.from("contact_reminders").insert(
    contactIds.map((contact_id) => ({
      contact_id,
      remind_at: remindAt.toISOString(),
      note: note?.trim() || null,
    })),
  );
  if (error) throw error;
}

export async function completeReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from("contact_reminders")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from("contact_reminders").delete().eq("id", id);
  if (error) throw error;
}
