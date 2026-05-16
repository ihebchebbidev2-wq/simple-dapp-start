import React from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";

interface EditableSectionProps {
  sectionKey: string;
  showEdit?: boolean;
  /** Use `dark` on dark backgrounds (e.g. hero) so the edit control stays readable */
  variant?: "default" | "dark";
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Wraps landing page sections. When showEdit is true (admin logged in),
 * shows an edit icon that links to Admin Landing editor for that section.
 */
export function EditableSection({
  sectionKey,
  showEdit = false,
  variant = "default",
  children,
  className = "",
  id,
}: EditableSectionProps) {
  const editClasses =
    variant === "dark"
      ? "bg-white/95 text-foreground border-white/30 shadow-md hover:bg-white hover:border-white/50"
      : "bg-background/95 border-border text-muted-foreground hover:text-foreground hover:bg-background shadow-sm";

  return (
    <div id={id} className={`relative group/edit ${className}`}>
      {showEdit && (
        <Link
          to={`/admin/landing#section-${sectionKey}`}
          className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${editClasses}`}
          title="Edit in CMS (Admin Landing)"
          aria-label={`Edit ${sectionKey.replace(/_/g, " ")} section in CMS`}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Edit
        </Link>
      )}
      {children}
    </div>
  );
}
