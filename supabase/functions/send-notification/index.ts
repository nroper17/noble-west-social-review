import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable. Secret not configured in Supabase.')
    }

    const reqBody = await req.json()
    const to = reqBody.to
    const html = reqBody.html
    const escapeHtml = (unsafe: string) => unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const subject = reqBody.subject ? escapeHtml(reqBody.subject) : undefined;
    
    console.log(`Received request to send email to: ${JSON.stringify(to)} | Subject: ${subject}`)

    if (!to || !subject || !html) {
      console.error('Validation failed: Missing required fields: to, subject, html')
      throw new Error('Missing required fields: to, subject, html')
    }

    // Call Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // By default on the free tier, Resend ONLY allows you to send emails from "onboarding@resend.dev"
        // AND it ONLY allows sending to the email address you signed up with.
        // To send to other teammates or clients, you must Add and Verify your domain (e.g. noble-west.com) in Resend.
        from: 'Noble West Social <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()
    
    if (!res.ok) {
      console.error(`Resend API rejected the request: ${JSON.stringify(data)}`)
      throw new Error(`Resend Error: ${data.message || 'Unknown error'}`)
    }

    console.log(`Resend API accepted the request! ID: ${data.id}`)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error(`Edge Function execution failed: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
