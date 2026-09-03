# School outreach email — draft

Not sent. Ten a day, oldest-listed first, from `dubai-schools@can-du-ai.com`.

## Merge fields

| Field | Source | Coverage |
|---|---|---|
| `{{school_name}}` | `schools.name` | 232 |
| `{{school_url}}` | `https://dubai-schools.can-du-ai.com/schools/{slug}` | 232 |
| `{{greeting}}` | `"Dear " + schools.principal`, else `"Dear Principal"` | 223 named |
| `{{to}}` | `schools.khda_email` | 215 |

Seventeen schools have no KHDA-published address and cannot be mailed at all.

## Subject

```
{{school_name}} is listed on Dubai Schools — is everything correct?
```

It says what it is and gives a reason to open that is about them, not about
me. No "quick question", no urgency, nothing that reads as a sales opener.

## Body

```
{{greeting}},

I built Dubai Schools, a free public directory of every private school
registered with KHDA. {{school_name}} is already listed:

{{school_url}}

I made it because comparing schools in Dubai means opening a dozen
different sites. KHDA publishes the data, but it is spread across
separate fact sheets and hard to hold side by side. Dubai Schools puts
curriculum, KHDA rating, area, grade range and published fees in one
searchable place. It is free, there is no account, and nothing about it
is paid.

That also means your entry is built entirely from KHDA's public records.
It is accurate as far as it goes, but it says nothing about what your
school is actually like.

If you would like to add to it, I would welcome any of:

  - a short description of the school in your own words
  - what you would want a parent to know first
  - photographs you hold the rights to and are happy to see published
  - corrections to anything we have wrong

Just reply to this email with whatever you would like included.

If you would rather not hear from me again, say so and I will not write
a second time.

Kind regards,

Husam Al-Qawasmeh
Dubai Schools
dubai-schools.can-du-ai.com
dubai-schools@can-du-ai.com
```

## Sending notes

Plain text, no HTML, no images, no tracking pixel, no shortened or rewritten
links. A first contact that looks like a campaign gets filed as one — and the
only link in it points at their own page on the site.

The line about photographs asks them to confirm they hold the rights. Their
own prospectus shots are usually work-for-hire and fine; a photographer's
portfolio image is not theirs to give, and this puts that on the record.

The opt-out line is deliberate. It costs one sentence, it is the courteous
thing, and a reply asking to stop is worth far more than a spam complaint.
