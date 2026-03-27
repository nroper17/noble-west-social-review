import { supabase } from './supabase'

export type NotificationType = 'mention' | 'status_change' | 'new_asset'

export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendNotification(
  workspaceId: string,
  type: NotificationType,
  subject: string,
  html: string,
  mentionedEmail?: string
) {
  try {
    let toEmails: string[] = []

    if (type === 'mention' && mentionedEmail) {
      // Just notify the mentioned person
      toEmails = [mentionedEmail]
    } else {
      // Notify all team members in this workspace who want immediate notifications
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select(`
          profiles!inner(
            email,
            notification_pref
          )
        `)
        .eq('workspace_id', workspaceId)
      
      if (error) throw error

      if (members) {
        toEmails = members
          .filter((m: any) => m.profiles.notification_pref === 'immediate')
          .map((m: any) => m.profiles.email)
      }
    }

    // Deduplicate and remove empty
    toEmails = [...new Set(toEmails.filter(Boolean))]

    if (toEmails.length === 0) {
      console.log('No recipients for notification:', type)
      return
    }

    console.log(`Sending ${type} notification to:`, toEmails)

    const { error: invokeError } = await supabase.functions.invoke('send-notification', {
      body: {
        to: toEmails,
        subject,
        html
      }
    })

    if (invokeError) throw invokeError

  } catch (error) {
    console.error('Failed to send notification via Edge Function', error)
  }
}
