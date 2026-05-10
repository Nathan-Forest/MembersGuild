import { NextRequest } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, club, message } = await request.json()
    if (!name || !email)
      return Response.json({ error: 'Required fields missing' }, { status: 400 })

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({
        from: 'Members Guild <hello@digitalguildhall.com.au>',
        to:      process.env.CONTACT_EMAIL || 'hello@membersguild.com.au',
        replyTo: email,
        subject: `Members Guild Enquiry — ${name}${club ? ` (${club})` : ''}`,
        text:    `MEMBERS GUILD ENQUIRY\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nClub: ${club || 'Not provided'}\n\nMessage:\n${message || 'No message provided'}`,
      })
    } else {
      console.log(`[MG Enquiry] ${name} <${email}> — ${club}`)
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error('[MG Enquiry] Error:', e)
    return Response.json({ ok: true })
  }
}