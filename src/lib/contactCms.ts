/**
 * Contact page CMS sections (slug `contact`): intro, form_labels, sidebar, map.
 * form_labels.content / sidebar.content are JSON strings in the DB.
 */

export interface ContactIntroCms {
  eyebrow: string;
  heading: string;
  body: string;
}

export interface ContactFormLabelsCms {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
}

export interface ContactSidebarCms {
  address_label: string;
  phone_label: string;
  phone: string;
  email_label: string;
  email: string;
  hours_label: string;
  hours: string;
}

export interface ContactMapCopyCms {
  heading: string;
  subtitle: string;
}

export type ContactSectionRow = {
  section_key: string;
  title?: string;
  description?: string;
  content?: string;
};

export function parseLabelsJson(raw: string | undefined, fallback: ContactFormLabelsCms): ContactFormLabelsCms {
  if (!raw?.trim()) return { ...fallback };
  try {
    const j = JSON.parse(raw) as Partial<ContactFormLabelsCms>;
    return {
      name: j.name ?? fallback.name,
      email: j.email ?? fallback.email,
      subject: j.subject ?? fallback.subject,
      message: j.message ?? fallback.message,
      send: j.send ?? fallback.send,
    };
  } catch {
    return { ...fallback };
  }
}

export function parseSidebarJson(raw: string | undefined, fallback: ContactSidebarCms): ContactSidebarCms {
  if (!raw?.trim()) return { ...fallback };
  try {
    const j = JSON.parse(raw) as Partial<ContactSidebarCms>;
    return {
      address_label: j.address_label ?? fallback.address_label,
      phone_label: j.phone_label ?? fallback.phone_label,
      phone: j.phone ?? fallback.phone,
      email_label: j.email_label ?? fallback.email_label,
      email: j.email ?? fallback.email,
      hours_label: j.hours_label ?? fallback.hours_label,
      hours: j.hours ?? fallback.hours,
    };
  } catch {
    return { ...fallback };
  }
}

export function getSection(rows: ContactSectionRow[], key: string): ContactSectionRow | undefined {
  return rows.find((r) => r.section_key === key);
}

export function introFromSection(
  row: ContactSectionRow | undefined,
  fallbacks: { eyebrow: string; heading: string; body: string }
): ContactIntroCms {
  return {
    eyebrow: row?.title?.trim() || fallbacks.eyebrow,
    heading: row?.description?.trim() || fallbacks.heading,
    body: row?.content?.trim() || fallbacks.body,
  };
}

export function mapCopyFromSection(
  row: ContactSectionRow | undefined,
  fallbacks: ContactMapCopyCms
): ContactMapCopyCms {
  return {
    heading: row?.title?.trim() || fallbacks.heading,
    subtitle: row?.description?.trim() || fallbacks.subtitle,
  };
}
