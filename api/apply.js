// Vercel serverless function: receives the profile form, emails the Havox team,
// and sends an automatic welcome email to the applicant (via Resend).
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY  - API key from resend.com
//   FROM_EMAIL      - e.g. "Havox International <hello@havoxinternational.com>" (domain must be verified in Resend)
//   NOTIFY_EMAIL    - where YOU receive each submission (comma separated for several)

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max) => String(v || '').trim().slice(0, max);
const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

async function sendMail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this

  const d = {
    fullName: clean(b.fullName, 120),
    designation: clean(b.designation, 120),
    profileType: clean(b.profileType, 40),
    organization: clean(b.organization, 160),
    industry: clean(b.industry, 120),
    phone: clean(b.phone, 40),
    email: clean(b.email, 256),
    story: clean(b.story, 2000),
  };

  for (const k of Object.keys(d)) if (!d[k]) return res.status(400).json({ error: 'Please fill in all required fields.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!['Business Owner', 'Professional'].includes(d.profileType)) return res.status(400).json({ error: 'Please choose Business Owner or Professional.' });
  if (wordCount(d.story) > 200) return res.status(400).json({ error: 'Please keep your story within 200 words.' });

  const from = process.env.FROM_EMAIL;
  const notify = (process.env.NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!process.env.RESEND_API_KEY || !from || !notify.length) {
    console.error('Missing RESEND_API_KEY / FROM_EMAIL / NOTIFY_EMAIL');
    return res.status(500).json({ error: 'Server is not configured yet.' });
  }

  try {
    // 1) notification to the Havox team
    await sendMail({
      from,
      to: notify,
      reply_to: d.email,
      subject: `New program application: ${d.fullName}`,
      html: `<h2>New application</h2>
        <p><b>Name:</b> ${esc(d.fullName)}<br>
        <b>Designation:</b> ${esc(d.designation)}<br>
        <b>Type:</b> ${esc(d.profileType)}<br>
        <b>Organization:</b> ${esc(d.organization)}<br>
        <b>Industry:</b> ${esc(d.industry)}<br>
        <b>Phone:</b> ${esc(d.phone)}<br>
        <b>Email:</b> ${esc(d.email)}</p>
        <p><b>Past, present &amp; future:</b><br>${esc(d.story).replace(/\n/g, '<br>')}</p>`,
    });

    // 2) automatic welcome email to the applicant
    await sendMail({
      from,
      to: [d.email],
      reply_to: notify[0],
      subject: 'Welcome to Havox International!',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#111">
        <h2>Welcome to Havox International, ${esc(d.fullName)}!</h2>
        <p>Thank you for sharing your profile. We have received your application and we are delighted to
        accept it. You are welcome to our program.</p>
        <p>Our team will contact you shortly on <b>${esc(d.phone)}</b> or at this email address with your next steps.</p>
        <p>Your voice is power, and we look forward to helping you unlock it.</p>
        <p>Warm regards,<br><b>Team Havox International</b></p></div>`,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'We could not send your submission. Please try again.' });
  }
};
