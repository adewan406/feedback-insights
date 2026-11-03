// The bell in the header: what the automation told the team (stored in Snowflake).
import { useEffect, useRef, useState } from "react";

const ICON = { urgent: "⚠", error: "✕", warning: "●", info: "✦" };
const LABEL = { urgent: "Urgent", error: "Failed", warning: "New problem", info: "Report" };

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Notifications({ items, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = items.filter((n) => !n.read).length;

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggle() {
    if (!open) onOpen();
    setOpen(!open);
  }

  return (
    <div className="notif" ref={ref}>
      <button className="btn btn-ghost notif-button" onClick={toggle} aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        🔔{unread > 0 && <span className="notif-count">{unread}</span>}
      </button>
      {open && (
        <div className="card notif-panel" role="dialog" aria-label="Notifications">
          <div className="card-head"><h2>Notifications</h2><span className="muted">from the automation</span></div>
          {!items.length && <p className="muted">Nothing yet. Notifications appear after each upload is analyzed.</p>}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={`notif-item notif-${n.level} ${n.read ? "" : "unread"}`}>
                <span className="notif-icon" aria-hidden="true">{ICON[n.level] || "•"}</span>
                <div>
                  <p className="notif-title"><span className="sr-only">{LABEL[n.level]}: </span>{n.title}</p>
                  <p className="notif-body">{n.body}</p>
                  <p className="muted small">{timeAgo(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
